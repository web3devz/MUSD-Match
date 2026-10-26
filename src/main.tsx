import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { amount, formatAmount, short } from './offers';
import './styles.css';
import { LiveTrading } from './LiveTrading';

type Example = { id: string; seller: string; musd: string; btc: string; expires: string; private?: boolean };
const examples: Example[] = [
  { id: '01', seller: '0x7A91…3bD2', musd: '1000', btc: '0.0102', expires: '42 min' },
  { id: '02', seller: '0xB4c8…91F0', musd: '2500', btc: '0.0258', expires: '2 hours' },
  { id: '03', seller: '0x2dF6…8a17', musd: '500', btc: '0.0053', expires: '5 hours' },
  { id: '04', seller: '0x9E32…5C4b', musd: '5000', btc: '0.0525', expires: '1 day' },
];
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    swap: <><path d="M4 8h16l-4-4M20 16H4l4 4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    link: <><path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 0) scale(.95)"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    external: <><path d="M14 3h7v7M21 3 11 13M10 3H4v17h17v-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M16 11h5v5h-5zM5 5V3h13"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}
function App() {
  const [mode, setMode] = useState<'example' | 'testnet'>(location.hash.startsWith('#offer=') ? 'testnet' : 'example');
  const [page, setPage] = useState('Explore offers');
  const [modal, setModal] = useState<'create' | 'review' | null>(null);
  const [selected, setSelected] = useState<Example | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('best');
  const [musd, setMusd] = useState('1000');
  const [btc, setBtc] = useState('0.0102');
  const [expiry, setExpiry] = useState('60');
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState<Example[]>([]);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState('');
  const [createSignal, setCreateSignal] = useState(0);
  const modalRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const p = (window as unknown as { ethereum?: { request: (args: {method:string})=>Promise<string[]>; on?: (event:string,handler:(accounts:string[])=>void)=>void; removeListener?: (event:string,handler:(accounts:string[])=>void)=>void } }).ethereum;
    if (!p) return;
    const changed = (accounts:string[])=>setWallet(accounts[0] || '');
    void p.request({method:'eth_accounts'}).then(changed).catch(()=>{});
    p.on?.('accountsChanged',changed);
    return ()=>p.removeListener?.('accountsChanged',changed);
  }, []);
  useEffect(() => { const el = modalRef.current; if (!el) return; if (modal) { if (!el.open) el.showModal(); } else if (el.open) el.close(); }, [modal]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
  function openCreate() { if (mode === 'testnet') { setCreateSignal(n=>n+1); return; } setError(''); setModal('create'); }
  function createExample(e: React.FormEvent) {
    e.preventDefault();
    try {
      amount(musd); amount(btc);
      setCreated(old => [{ id: `local-${Date.now()}`, seller: 'Your example offer', musd, btc, expires: `${expiry} min` }, ...old]);
      setModal(null); setPage('My offers'); setNotice('Example offer created. No wallet signature or transaction was requested.');
    } catch (err) { setError((err as Error).message); }
  }
  async function connect() {
    const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!provider) { setNotice('Install an EVM wallet to connect. You can explore example offers without one.'); return; }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      setWallet(accounts[0] || '');
      if (mode === 'testnet' && (await provider.request({ method: 'eth_chainId' }) as string).toLowerCase() !== '0x7b7b') {
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7b7b' }] }); }
        catch (e) {
          if ((e as { code?: number }).code !== 4902) throw e;
          await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x7b7b', chainName: 'Mezo Testnet', nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 }, rpcUrls: ['https://rpc.test.mezo.org'], blockExplorerUrls: ['https://explorer.test.mezo.org'] }] });
        }
      }
    } catch { setNotice('Wallet connection or Mezo testnet switch was not completed.'); }
  }
  let offers = mode === 'example' ? (page === 'My offers' ? created : [...created, ...examples]) : [];
  offers = offers.filter(o => `${o.musd} ${o.seller}`.toLowerCase().includes(query.toLowerCase()));
  if (sort === 'best') offers = [...offers].sort((a, b) => Number(a.btc) / Number(a.musd) - Number(b.btc) / Number(b.musd));
  if (sort === 'size') offers = [...offers].sort((a, b) => Number(b.musd) - Number(a.musd));
  const rate = (() => { try { return formatAmount(amount(musd) * 10n ** 18n / amount(btc), 2); } catch { return '—'; } })();
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="MUSD Match home"><span className="brand-mark"><Icon name="swap" size={23}/></span><span>musd<span className="brand-light">match</span><small>MEET IN THE MIDDLE</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{[['Explore offers','grid'], ['My offers','swap'], ['How it works','shield']].map(([label, icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => setPage(label)}><Icon name={icon}/>{label}{label === 'Explore offers' && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="network-card"><span className="network-orbit">m</span><div>Built on Mezo<small>Bitcoin-backed. People-powered.</small></div></div><a href="https://mezo.org/docs/developers/" target="_blank" rel="noreferrer">Mezo documentation <Icon name="external" size={14}/></a><span className="version">MUSD MATCH · EARLY ACCESS</span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="topbar-actions"><span className="network-pill"><i/>{mode === 'example' ? 'Example mode' : 'Mezo testnet'}</span><button className="wallet-button" onClick={connect}><Icon name="wallet" size={16}/>{wallet ? short(wallet) : 'Connect wallet'}</button></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow"><span/>DIRECT TRADES. BETTER CONNECTIONS.</div><h1>{page === 'Explore offers' ? <>A better way to<br/><span>meet in the middle.</span></> : page === 'My offers' ? <>Your terms.<br/><span>Your offers.</span></> : <>Two wallets.<br/><span>One atomic trade.</span></>}</h1><p className="intro">Trade Bitcoin-backed dollars directly with people.<br className="desktop-break"/> Set your terms. Skip the liquidity pool. Settle on Mezo.</p></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-token musd-token"><span>m</span><small>MUSD</small></div><div className="art-connection"><Icon name="swap" size={26}/></div><div className="art-token btc-token">₿<small>BITCOIN</small></div><div className="art-caption"><span/>A direct connection changes everything.</div></div></div>
      <section className="principles" aria-label="Trade benefits"><div><span className="principle-icon"><Icon name="shield"/></span><div><strong>Both sides. One transaction.</strong><p>Both assets move, or neither does.</p></div></div><div><span className="principle-icon"><Icon name="swap"/></span><div><strong>Your price is the price.</strong><p>Exact terms. No AMM price impact.</p></div></div><div><span className="principle-icon"><Icon name="link"/></span><div><strong>Share it. Match it.</strong><p>A private link, a direct counterparty.</p></div></div></section>
      {page === 'How it works' ? <section className="how-panel"><div className="section-title"><h2>A handshake, written in code.</h2></div>{[['01','Make an offer','Choose how much MUSD to sell, the exact BTC you want, and an expiry. Signing an offer does not lock your funds.'],['02','Find your match','Share the signed link. Your counterparty checks the terms and current availability before accepting.'],['03','Settle together','The settlement contract transfers MUSD to the buyer and BTC to the seller in the same transaction. A failed leg reverts the entire trade.']].map(([n,title,desc])=><article className="how-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{desc}</p></div></article>)}<div className="risk-note">Offers can expire or become unavailable if a seller moves funds or revokes approval. Signing does not guarantee a fill. Contracts are not independently audited. Testnet funds only.</div></section> : <>
      <div className="board-heading"><div><h2>{page === 'My offers' ? 'My offers' : 'Find your next match'}{mode === 'example' && <span className="count">{offers.length}</span>}</h2><p>Buy MUSD with BTC. Every offer is filled in full.</p></div><button className="primary" onClick={openCreate}><Icon name="plus" size={17}/>Create an offer</button></div>
      <div className="board-toolbar"><div className="mode-switch" aria-label="Data mode"><button className={mode === 'example' ? 'selected' : ''} onClick={()=>setMode('example')}>Explore examples</button><button className={mode === 'testnet' ? 'selected' : ''} onClick={()=>setMode('testnet')}>Mezo testnet</button></div>{mode === 'example' && <div className="filters"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Search offers" placeholder="Search offers…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Sort offers" value={sort} onChange={e=>setSort(e.target.value)}><option value="best">Lowest BTC per MUSD</option><option value="size">Largest offer</option></select></div>}</div>
      {mode === 'testnet' ? <LiveTrading wallet={wallet} mine={page==='My offers'} createSignal={createSignal}/> : <><div className={`data-banner `}><span className="banner-label">{mode === 'example' ? 'EXAMPLE DATA' : 'TESTNET'}</span>{mode === 'example' ? 'A little room to explore. These offers are illustrative and cannot be traded.' : 'Settlement deployment pending. Live trading is disabled until a verified contract is configured.'}</div>
      <section className="offer-board" aria-label="MUSD offers"><div className="table-header"><span>YOU RECEIVE</span><span>YOU PAY</span><span>OFFER RATE</span><span>SELLER / EXPIRY</span><span/></div>{offers.map((o,i)=><article className="offer-row" key={o.id}><div className="asset-cell"><span className="currency musd-currency">m</span><div><strong>{formatAmount(amount(o.musd),2)} <small>MUSD</small></strong><span>Bitcoin-backed dollars</span></div></div><div className="pay-cell"><strong>{o.btc} <small>BTC</small></strong><span>Exact amount · plus network gas</span></div><div className="rate-cell"><strong>{formatAmount(amount(o.musd)*10n**18n/amount(o.btc),2)}</strong><span>MUSD per BTC {i===0 && <b>BEST SHOWN</b>}</span></div><div className="seller-cell"><strong><span className={`avatar avatar-${i%3}`}/>{o.seller}</strong><span><Icon name="clock" size={12}/>{o.expires} · illustrative</span></div><button className="review-button" onClick={()=>{setSelected(o);setModal('review');}}>Review offer<Icon name="arrow" size={15}/></button></article>)}{offers.length===0&&<div className="empty-state"><Icon name="swap" size={32}/><h3>No offers here yet.</h3><p>Create an example offer or try a different search.</p><button className="review-button" onClick={openCreate}>Create example offer<Icon name="arrow" size={15}/></button></div>}</section>
      <div className="board-footnote"><span><Icon name="shield" size={14}/>No pooled deposits. No protocol fee in v1.</span><span>Offers aren’t reserved until settlement.</span></div>
      </>}<section className="bottom-cta"><div className="cta-symbol">↗</div><div><h3>Have MUSD? Find the other side.</h3><p>Choose your price and share an offer. Your funds stay in your wallet until it fills.</p></div><button onClick={openCreate}>Make your first offer <Icon name="arrow" size={17}/></button></section></>}
      <footer><span>Built for the Bitcoin economy.</span><span>MUSD Match <span className="footer-dot">·</span> Mezo testnet <span className="footer-dot">·</span> Not independently audited</span></footer>
    </main></div>
    {notice && <div className="toast" role="status"><Icon name="check"/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><Icon name="close" size={16}/></button></div>}
    <dialog ref={modalRef} onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}} aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={()=>setModal(null)}><Icon name="close"/></button>{modal==='create'?<form onSubmit={createExample}><div className="eyebrow">YOUR PRICE. YOUR TERMS.</div><h2 id="modal-title">Create an offer</h2><p className="modal-description">{mode==='example'?'Try the flow with example data. No funds will move.':'Live offer creation will unlock after settlement deployment.'}</p><label className="field">You sell<div className="amount-input"><input required inputMode="decimal" value={musd} onChange={e=>setMusd(e.target.value)} aria-label="MUSD amount to sell"/><span><span className="currency musd-currency">m</span>MUSD</span></div></label><label className="field">You receive<div className="amount-input"><input required inputMode="decimal" value={btc} onChange={e=>setBtc(e.target.value)} aria-label="BTC amount to receive"/><span className="btc-label">₿ BTC</span></div></label><div className="quote-line"><span>Your offer rate</span><strong>{rate} MUSD / BTC</strong></div><label className="field">Offer expires in<select value={expiry} onChange={e=>setExpiry(e.target.value)}><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option></select></label><div className="risk-note">Full fills only. The seller must retain enough MUSD and allowance until settlement. No savings versus a market price are implied.</div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary full-width" disabled={mode==='testnet'} type="submit">{mode==='example'?'Create example offer':'Deployment required'}<Icon name="arrow" size={17}/></button></form>:selected&&<div><div className="eyebrow">EXAMPLE OFFER · NO FUNDS MOVE</div><h2 id="modal-title">A match on your terms.</h2><p className="modal-description">Review both sides of the exchange before you decide.</p><div className="review-summary"><div><span>You receive</span><strong>{formatAmount(amount(selected.musd),2)} <small>MUSD</small></strong></div><Icon name="swap"/><div><span>You pay</span><strong>{selected.btc} <small>BTC</small></strong></div></div><dl className="review-details"><div><dt>Seller</dt><dd>{selected.seller}</dd></div><div><dt>Fill type</dt><dd>Full offer only</dd></div><div><dt>Protocol fee</dt><dd>0</dd></div><div><dt>Network gas</dt><dd>Paid separately in BTC</dd></div></dl><div className="risk-note">This is an illustrative offer. In live mode, signature, wallet funds, approval, expiry and transaction simulation must pass before filling.</div><button className="primary full-width" onClick={()=>{setModal(null);setNotice('Example review complete. No trade was sent.');}}>Finish example review<Icon name="check" size={17}/></button></div>}</dialog>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
