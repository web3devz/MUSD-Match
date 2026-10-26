import { useEffect, useRef, useState } from 'react';
import { getAddress, isAddress, zeroAddress, type Hex } from 'viem';
import { amount, decodeOffer, encodeOffer, formatAmount, nonce, short, type SignedOffer } from './offers';
import * as network from './chain';

type Props = { wallet: string; mine: boolean; createSignal: number };
export function LiveTrading({ wallet, mine, createSignal }: Props) {
  const [offers, setOffers] = useState<SignedOffer[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(network.configured ? 'Checking deployment…' : 'No verified deployment configured');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [hash, setHash] = useState<Hex>();
  const [pendingHashes, setPendingHashes] = useState<Hex[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<SignedOffer>();
  const [musd, setMusd] = useState('1000');
  const [btc, setBtc] = useState('0.01');
  const [expiry, setExpiry] = useState('60');
  const [taker, setTaker] = useState('');
  const [importText, setImportText] = useState('');
  const [share, setShare] = useState('');
  const [checked, setChecked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const storageKey = `musd-match:31611:${network.settlement || 'unconfigured'}`;
  useEffect(() => {
    let active = true;
    if (!network.configured) return;
    network.verifyDeployment().then(() => { if (active) { setVerified(true); setStatus('Deployment verified · Mezo testnet'); } }).catch(e => { if (active) { setVerified(false); setStatus(network.explain(e)); } });
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setOffers(stored.slice(0, 100).flatMap(value => { try { return [decodeOffer(value, network.settlement!)]; } catch { return []; } }));
    } catch { setError('Saved offers could not be read. Your wallet is unaffected.'); }
    function loadFragment() {
      if (!location.hash.startsWith('#offer=')) return;
      try { const offer = decodeOffer(location.hash.slice(7), network.settlement!); setSelected(offer); setChecked(false); } catch(e) { setError(network.explain(e)); }
    }
    loadFragment(); window.addEventListener('hashchange', loadFragment);
    return () => { active = false; window.removeEventListener('hashchange', loadFragment); };
  }, [storageKey]);
  useEffect(() => { if (createSignal) { setCreateOpen(true); setSelected(undefined); setShare(''); setError(''); } }, [createSignal]);
  useEffect(() => { const el = dialog.current; if (!el) return; if (createOpen || selected) { if (!el.open) el.showModal(); } else if (el.open) el.close(); }, [createOpen, selected]);
  useEffect(() => { setChecked(false); }, [wallet, selected]);
  function save(offer: SignedOffer) {
    setOffers(previous => {
      const updated = [offer, ...previous.filter(o => !(o.offer.maker === offer.offer.maker && o.offer.nonce === offer.offer.nonce))].slice(0, 100);
      try { localStorage.setItem(storageKey, JSON.stringify(updated.map(encodeOffer))); } catch { setError('Offer signed, but browser storage is unavailable. Copy the private link now to keep it.'); }
      return updated;
    });
  }
  async function action(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setHash(undefined); setChecked(false);
    try { await fn(); } catch (e) { setError(network.explain(e)); setStage('Action needs attention'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function transact(fn: () => Promise<Hex>) {
    setStage('Simulating, then awaiting your wallet confirmation…');
    const h = await fn(); setHash(h); setPendingHashes(previous => [...previous, h]); setStage('Submitted · waiting for a chain receipt. Do not send again.');
    try { await network.receipt(h); setPendingHashes(previous => previous.filter(v=>v!==h)); setStage('Confirmed on Mezo testnet. Recheck availability before any next action.'); }
    catch { setStage('Receipt unavailable or reverted. Check the explorer before retrying.'); throw new Error('Receipt could not be confirmed. The transaction may already be mined; do not submit again until you check its receipt.'); }
  }
  function importOffer() {
    try {
      if (!network.settlement) throw new Error('Configure a verified settlement first.');
      const encoded = importText.includes('#offer=') ? importText.split('#offer=')[1] : importText;
      const signed = decodeOffer(encoded, network.settlement);
      setSelected(signed); setCreateOpen(false); setError(''); setChecked(false); setStage('Imported offer · signature and availability have not been checked.');
    } catch(e) { setError(network.explain(e)); }
  }
  const shown = offers.filter(o => !mine || (!!wallet && getAddress(wallet) === o.offer.maker));
  const maker = !!selected && !!wallet && getAddress(wallet) === selected.offer.maker;
  const close = () => { if (!busy) { setCreateOpen(false); setSelected(undefined); setChecked(false); } };
  return <section className="live-trading">
    <div className={`data-banner live-banner`}><span className="banner-label">TESTNET</span>{status}</div>
    <div className="live-instructions"><div><strong>Signed links. Direct counterparties.</strong><p>This is your browser’s local offer list, not a global orderbook. Import a seller’s link or create your own. Offers do not reserve funds.</p></div><button className="primary" disabled={!verified || busy} onClick={()=>{setCreateOpen(true);setSelected(undefined);setError('');setShare('');}}>+ Create signed offer</button></div>
    <div className="import-line"><input aria-label="Signed offer link" placeholder="Paste a private offer link…" value={importText} onChange={e=>setImportText(e.target.value)}/><button className="review-button" onClick={importOffer} disabled={!verified || busy}>Import offer →</button></div>
    <section className="offer-board">{shown.map(s => <article className="live-offer" key={`${s.offer.maker}:${s.offer.nonce}`}><div><span>You receive</span><strong>{formatAmount(s.offer.musdAmount, 18)} MUSD</strong></div><div><span>You pay</span><strong>{formatAmount(s.offer.btcAmount, 18)} BTC</strong></div><div><span>Seller · expires</span><strong>{short(s.offer.maker)}</strong><small>{new Date(Number(s.offer.expiry)*1000).toLocaleString()}</small></div><button className="review-button" disabled={busy} onClick={()=>{setSelected(s);setCreateOpen(false);setChecked(false);setError('');setShare('');}}>Review →</button></article>)}{!shown.length && <div className="empty-state"><h3>{verified ? 'Ready for your first direct match.' : 'Built for a real handshake.'}</h3><p>{verified ? 'Create a signed offer or import a private link. No shared liquidity pool is needed.' : 'The wallet integration is ready, but live trading stays locked until a verified testnet deployment is configured.'}</p></div>}</section>
    {(stage || error) && <div className="transaction-status" role="status"><strong>{stage}</strong>{error&&<p role="alert" className="form-error">{error}</p>}{hash&&<a href={`https://explorer.test.mezo.org/tx/${hash}`} target="_blank" rel="noreferrer">Inspect transaction {short(hash)} ↗</a>}</div>}
    {!!pendingHashes.length && <div className="risk-note">Unconfirmed transaction(s): {pendingHashes.map(h=><a key={h} href={`https://explorer.test.mezo.org/tx/${h}`} target="_blank" rel="noreferrer">{short(h)} ↗ </a>)}Check receipts before repeating an action.</div>}
    <div className="board-footnote"><span>No protocol fee. BTC gas is separate.</span><span>Browser wallet · testnet only · unaudited</span></div>
    <dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else close();}} onClick={e=>{if(e.target===e.currentTarget)close();}} aria-labelledby="live-modal-title"><button className="modal-close" aria-label="Close" disabled={busy} onClick={close}>×</button>
      {createOpen ? <form onSubmit={e=>{e.preventDefault();void action(async()=>{
        if (!verified) throw new Error('Deployment is not verified.');
        if (taker && (!isAddress(taker) || getAddress(taker)===zeroAddress)) throw new Error('Enter a valid restricted buyer, or leave blank for a public offer.');
        const { account } = await network.wallet();
        const offer = { maker: getAddress(account), taker: taker ? getAddress(taker) : zeroAddress, musdAmount: amount(musd), btcAmount: amount(btc), expiry: BigInt(Math.floor(Date.now()/1000)+Number(expiry)*60), nonce: nonce() };
        setStage('Awaiting EIP-712 signature. This does not transfer funds.');
        const signed = await network.sign(offer); save(signed);setSelected(signed);setCreateOpen(false);setShare(`${location.origin}${location.pathname}#offer=${encodeOffer(signed)}`);setStage('Offer signed. Approve the exact MUSD amount before a buyer can fill.');
      });}}><div className="eyebrow">MEZO TESTNET · EXACT TERMS</div><h2 id="live-modal-title">Create a signed offer</h2><p className="modal-description">Your MUSD stays in your wallet until settlement. Signing alone does not approve spending.</p><label className="field">MUSD to sell<input required className="live-input" inputMode="decimal" value={musd} onChange={e=>setMusd(e.target.value)}/></label><label className="field">Exact BTC to receive<input required className="live-input" inputMode="decimal" value={btc} onChange={e=>setBtc(e.target.value)}/></label><label className="field">Expiry<select value={expiry} onChange={e=>setExpiry(e.target.value)}><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option></select></label><label className="field">Restricted buyer (optional)<input className="live-input" placeholder="0x… or leave blank for anyone" value={taker} onChange={e=>setTaker(e.target.value)}/></label><div className="risk-note">Public offers can be filled by anyone who sees the link. Use a restricted buyer for a private allocation. An approval applies to your settlement contract allowance, not just one signature.</div><button className="primary full-width" disabled={busy || !verified}>Sign exact terms →</button></form> : selected && <div><div className="eyebrow">MEZO TESTNET · FULL FILL ONLY</div><h2 id="live-modal-title">Review the exchange.</h2><div className="review-summary"><div><span>You receive</span><strong>{formatAmount(selected.offer.musdAmount, 18)} <small>MUSD</small></strong></div><span>⇄</span><div><span>You pay</span><strong>{formatAmount(selected.offer.btcAmount, 18)} <small>BTC</small></strong></div></div><dl className="review-details"><div><dt>Seller</dt><dd>{short(selected.offer.maker)}</dd></div><div><dt>Buyer</dt><dd>{selected.offer.taker===zeroAddress?'Anyone with the link':short(selected.offer.taker)}</dd></div><div><dt>Expiry</dt><dd>{new Date(Number(selected.offer.expiry)*1000).toLocaleString()}</dd></div><div><dt>Protocol fee</dt><dd>0 · network gas is additional</dd></div></dl>
      {maker ? <><button className="primary full-width" disabled={busy || !verified} onClick={()=>void action(()=>transact(()=>network.approve(selected)))}>Approve exactly {formatAmount(selected.offer.musdAmount,18)} MUSD</button><button className="review-button full-width" disabled={busy} onClick={()=>setShare(`${location.origin}${location.pathname}#offer=${encodeOffer(selected)}`)}>Show private offer link</button><button className="danger-button full-width" disabled={busy || !verified} onClick={()=>void action(()=>transact(()=>network.cancel(selected)))}>Cancel this nonce on chain</button></> : <><button className="review-button full-width" disabled={busy || !verified} onClick={()=>void action(async()=>{await network.verifyDeployment();await network.availability(selected);setChecked(true);setStage('Signature, seller funds, allowance and nonce checked. Availability can still change.');save(selected);})}>Check signature & availability</button><button className="primary full-width" disabled={busy || !verified || !checked || !wallet || pendingHashes.length>0} onClick={()=>void action(()=>transact(()=>network.fill(selected)))}>Pay {formatAmount(selected.offer.btcAmount,18)} BTC & receive MUSD</button></>}
      {share&&<label className="field">Private offer link<textarea className="share-text" readOnly value={share} onFocus={e=>e.currentTarget.select()}/><button className="review-button full-width" disabled={busy} onClick={()=>{void navigator.clipboard.writeText(share).then(()=>setStage('Private link copied.')).catch(()=>setError('Copy unavailable. Select and copy the link manually.'));}}>Copy link</button></label>}
      <div className="risk-note">Both assets settle or the transaction reverts. Signatures do not reserve funds. No market savings are claimed. Existing allowance may change as other offers fill.</div></div>}
      {busy&&<p className="modal-description" role="status">{stage}</p>}{!busy&&stage&&<p className="modal-description" role="status">{stage}</p>}{error&&<p className="form-error" role="alert">{error}</p>}{hash&&<a className="receipt-link" href={`https://explorer.test.mezo.org/tx/${hash}`} target="_blank" rel="noreferrer">View transaction {short(hash)} ↗</a>}
    </dialog>
  </section>;
}
