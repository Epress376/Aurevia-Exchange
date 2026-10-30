"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Nav from "@/components/Nav";
import { useLocale } from "@/lib/i18n-context";
import PriceChart from "@/components/PriceChart";
import LivePriceChart from "@/components/LivePriceChart";
import type { MarketQuote, TimeframeId } from "@/lib/live-market";
import { useTradingStore } from "@/lib/store";
import { io, type Socket } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import { formatUsd } from "@/lib/currency-format";
type I = { id: string; symbol: string; price: number; change?: number; takerFee?: number; leverage?: number; updatedAt?:string; lastUpdatedAt?:string; assetId?:string; assetType?:string; source?:string; bid?:number|null; ask?:number|null; liveQuote?:MarketQuote };
type NumericValue=number|string;
type Order = {
  id: string;
  status: string;
  side: string;
  type: string;
  quantity: number;
  filledQuantity: number;
  price?: number;
  stopPrice?: number;
  providerName?: string|null;
  providerStatus?: string|null;
  instrument: { symbol: string };
};
type Pos = {
  id: string;
  instrumentId:string;
  side: string;
  quantity: number;
  entryPrice: number;
  margin: number;
  providerName:string|null;
  instrument: { symbol: string; price: number;updatedAt:string };
};
type PositionResponse=Omit<Pos,"quantity"|"entryPrice"|"margin"|"instrument">&{
  quantity:NumericValue;
  entryPrice:NumericValue;
  margin:NumericValue;
  instrument:{symbol:string;price:NumericValue;updatedAt:string};
};
type WalletResponse={accountMode:"DEMO"|"REAL";cashBalance:NumericValue;paperReservedBalance:NumericValue;paperAvailableBalance:NumericValue};
type OrderBookLevel={price:number;quantity:number};
type OrderBook={bids?:OrderBookLevel[];asks?:OrderBookLevel[]};
type LiveQuotesResponse={quotes:Array<MarketQuote|{asset:MarketQuote['asset'];error:string}>};
type MarketUpdate={symbol:string;price:number;change:number;changePercent:number;source:string;dataMode:'SIMULATED'|'LIVE';lastUpdatedAt:string};
const LIVE_TRADE_ASSET_IDS=["DJI","SPX","NASDAQ","SP100","NDX","DAX","IBEX","NIKKEI","MERV","EURGBP","BTC","AAPL","MSFT","NVDA","AMZN","GOOGL","TSLA"];

function normalizedSymbol(value:string){return value.toUpperCase().replace(/[^A-Z0-9]/g,"")}

async function loadTradingMarkets(mode:"DEMO"|"REAL"):Promise<I[]>{
  const instrumentResponse=await fetch("/api/market",{cache:"no-store"});
  if(!instrumentResponse.ok)throw new Error("Unable to load trading instruments.");
  const instruments=await instrumentResponse.json() as I[];
  if(mode==="DEMO")return instruments.map(item=>({...item,price:Number(item.price),updatedAt:item.lastUpdatedAt||item.updatedAt}));

  const quoteResponse=await fetch(`/api/live-markets?symbols=${LIVE_TRADE_ASSET_IDS.join(",")}`,{cache:"no-store"});
  if(!quoteResponse.ok)throw new Error("Live provider quotes are unavailable.");
  const {quotes}=await quoteResponse.json() as LiveQuotesResponse;
  const availableQuotes=quotes.filter((quote):quote is MarketQuote=>{
    if(!("price"in quote)||!Number.isFinite(quote.price)||quote.isStale)return false;
    const age=Date.now()-Date.parse(quote.updatedAt);
    return age<=30_000&&age>=-5_000;
  });
  return instruments.flatMap(instrument=>{
    const symbol=normalizedSymbol(instrument.symbol);
    const quote=availableQuotes.find(item=>
      symbol===normalizedSymbol(item.asset.id)||
      symbol===normalizedSymbol(item.asset.ticker)||
      item.asset.id==="BTC"&&symbol==="BTCUSD",
    );
    if(!quote)return [];
    return [{
      ...instrument,
      price:quote.price,
      change:quote.changePercent,
      updatedAt:quote.updatedAt,
      lastUpdatedAt:quote.updatedAt,
      assetId:quote.asset.id,
      assetType:quote.asset.type,
      source:quote.source,
      bid:quote.bid,
      ask:quote.ask,
      liveQuote:quote,
    }];
  });
}

export default function Trade() {
  const { translate } = useLocale();
  const {data:session,status:sessionStatus}=useSession();
  const [items, setItems] = useState<I[]>([]);
  const updateStore = useTradingStore((s) => s.updatePrices);
  const [selected, setSelected] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT" | "STOP">("MARKET");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [book, setBook] = useState<OrderBook>({ bids: [], asks: [] });
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [paperReservedBalance,setPaperReservedBalance]=useState(0);
  const [paperAvailableBalance,setPaperAvailableBalance]=useState(0);
  const [accountMode, setAccountMode] = useState<'DEMO'|'REAL'|'LOADING'>('LOADING');
  const [placing, setPlacing] = useState(false);
  const [chartTimeframe,setChartTimeframe]=useState<TimeframeId>("1d");
  const [liveCandles,setLiveCandles]=useState<Array<{time:number;open:number;high:number;low:number;close:number;volume:number|null}>>([]);
  const [chartLoading,setChartLoading]=useState(false);
  const [chartError,setChartError]=useState("");
  const [streamStatus,setStreamStatus]=useState<"connecting"|"connected"|"offline">("offline");
  useEffect(() => {
    if(sessionStatus!=='authenticated')return;
    let active = true;
    let activeMode:"DEMO"|"REAL"|undefined;
    setAccountMode('LOADING');
    setAvailableBalance(null);
    setOrders([]);
    setPositions([]);
    setMsg('');
    const load = async () => {
      try {
        const responses = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/positions"),
          fetch("/api/portfolio"),
        ]);
        if (responses.some((response) => !response.ok))
          throw new Error("Unable to load trading data.");
        const [orderData,positionData,walletData]=await Promise.all([
          responses[0].json() as Promise<Order[]>,
          responses[1].json() as Promise<PositionResponse[]>,
          responses[2].json() as Promise<WalletResponse>,
        ]);
        activeMode=walletData.accountMode;
        if (!active) return;
        setOrders(orderData);
        setAccountMode(walletData.accountMode);
        setAvailableBalance(Number(walletData.cashBalance));
        setPaperReservedBalance(Number(walletData.paperReservedBalance));
        setPaperAvailableBalance(Number(walletData.paperAvailableBalance));
        setPositions(
          positionData.map((position) => ({
            ...position,
            quantity: Number(position.quantity),
            entryPrice: Number(position.entryPrice),
            margin: Number(position.margin),
            instrument: {
              ...position.instrument,
              price: Number(position.instrument.price),
            },
          })),
        );
        const market=await loadTradingMarkets(walletData.accountMode);
        if (!active) return;
        setItems(market);
        setSelected(market[0]?.id||"");
        if(walletData.accountMode==="REAL"&&!market.length)setMsg("No fresh provider quotes are available for the supported trading instruments.");
      } catch {
        if (active){
          if(activeMode==="REAL"){
            setItems([]);
            setSelected("");
            setMsg("Unable to load fresh provider quotes. No simulated prices are shown for REAL orders.");
          }else setMsg("Unable to load trading data. Refresh to try again.");
        }
      }
    };
    void load();
    const refreshPrices=async()=>{
      if(!activeMode)return;
      try{
        const market=await loadTradingMarkets(activeMode);
        if(!active)return;
        setItems(market);
        setSelected(current=>market.some(item=>item.id===current)?current:market[0]?.id||"");
        if(activeMode==="DEMO")updateStore(market);
        if(activeMode==="REAL"&&!market.length)setMsg("Live provider quotes are temporarily unavailable. No simulated prices are being shown.");
        else setMsg(current=>current.startsWith("Live provider quotes")||current.startsWith("No fresh provider quotes")?"":current);
      }catch{
        if(active&&activeMode==="REAL"){
          setItems([]);
          setSelected("");
          setMsg("Unable to refresh provider quotes. No simulated prices are shown for REAL orders.");
        }
      }
    };
    const timer=window.setInterval(()=>void refreshPrices(),15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [updateStore,sessionStatus,session?.user?.accountMode]);
  useEffect(()=>{
    if(accountMode!=="REAL"){
      setStreamStatus("offline");
      return;
    }
    const socket:Socket=io({path:"/socket.io",transports:["websocket"],autoConnect:true,reconnection:true,reconnectionDelay:700});
    const onConnect=()=>setStreamStatus("connected");
    const onDisconnect=()=>setStreamStatus("offline");
    const onMarketUpdate=(updates:MarketUpdate[])=>{
      setItems(current=>current.map(item=>{
        const update=updates.find(entry=>entry.symbol===item.assetId&&entry.dataMode==="LIVE"&&Number.isFinite(entry.price)&&(entry.source==="Finnhub"||entry.source.startsWith("Alpaca")));
        if(!update||!item.liveQuote)return item;
        const liveQuote={...item.liveQuote,price:update.price,change:update.change,changePercent:update.changePercent,updatedAt:update.lastUpdatedAt,asOf:update.lastUpdatedAt,source:update.source,isStale:false};
        return {...item,price:update.price,change:update.changePercent,updatedAt:update.lastUpdatedAt,lastUpdatedAt:update.lastUpdatedAt,source:update.source,liveQuote};
      }));
    };
    socket.on("connect",onConnect);
    socket.on("disconnect",onDisconnect);
    socket.on("market:update",onMarketUpdate);
    setStreamStatus(socket.connected?"connected":"connecting");
    return()=>{socket.off("connect",onConnect);socket.off("disconnect",onDisconnect);socket.off("market:update",onMarketUpdate);socket.disconnect();};
  },[accountMode]);
  useEffect(() => {
    if(accountMode==="REAL"){
      setBook({bids:[],asks:[]});
      return;
    }
    if (!selected||accountMode!=='DEMO') return;
    const load = () =>
      fetch(`/api/orderbook?instrumentId=${selected}`)
        .then((r) => r.json())
        .then(setBook);
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [selected,accountMode]);
  const cur = items.find((i) => i.id === selected);
  const pnl = (p: Pos) => {
    const mark=items.find(item=>item.symbol===p.instrument.symbol);
    if(accountMode==="REAL"&&!mark?.liveQuote)return null;
    const price=mark?.price??(accountMode==="DEMO"?p.instrument.price:null);
    if(price===null)return null;
    return p.side==="BUY"?(price-p.entryPrice)*p.quantity:(p.entryPrice-price)*p.quantity;
  };
  useEffect(()=>{
    if(accountMode!=="REAL"||!cur?.assetId){
      setLiveCandles([]);
      setChartLoading(false);
      setChartError(accountMode==="REAL"?"No fresh provider quote is available for this instrument.":"");
      return;
    }
    let active=true;
    setChartLoading(true);
    setChartError("");
    fetch(`/api/live-markets/${encodeURIComponent(cur.assetId)}?timeframe=${chartTimeframe}`,{cache:"no-store"})
      .then(async response=>{
        const result=await response.json();
        if(!response.ok)throw new Error(typeof result.error==="string"?result.error:"Provider chart data is unavailable.");
        return result as {candles:typeof liveCandles};
      })
      .then(result=>{if(active)setLiveCandles(result.candles);})
      .catch(error=>{if(active){setLiveCandles([]);setChartError(error instanceof Error?error.message:"Provider chart data is unavailable.");}})
      .finally(()=>{if(active)setChartLoading(false);});
    return()=>{active=false;};
  },[accountMode,cur?.assetId,chartTimeframe]);
  const requestedQuantity = Number(qty);
  const estimatedNotional = (cur?.price ?? 0) * (Number.isFinite(requestedQuantity) ? requestedQuantity : 0);
  const estimatedFee = accountMode==='DEMO'?estimatedNotional * Number(cur?.takerFee ?? 0):0;
  const estimatedRequiredCash = estimatedNotional + estimatedFee;

  async function place(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placing) return;
    if(!cur||(accountMode==="REAL"&&!cur.liveQuote)){
      setMsg("A fresh provider quote is required before submitting this order.");
      return;
    }
    setPlacing(true);
    setMsg("");
    try {
      const body = {
        instrumentId: selected,
        side,
        type,
        quantity: Number(qty),
        price: type === "LIMIT" && price ? Number(price) : undefined,
        stopPrice: type === "STOP" && price ? Number(price) : undefined,
        expectedPrice:cur?.price,
        observedAt:cur?.updatedAt,
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMsg(response.ok
        ? result.status==='FILLED'?'Order filled.':result.status==='PARTIALLY_FILLED'?'Order partially filled.':`Order ${String(result.status||'submitted').replaceAll('_',' ').toLowerCase()}.`
        : result.error || "Order failed");
      if (response.ok) {
        setOrders((current) => [result, ...current]);
        const positionResponse = await fetch("/api/positions");
        setPositions(await positionResponse.json());
      }
    } catch {
      setMsg("Unable to submit the order. Check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  }
  async function cancel(id: string) {
    const r = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    if (r.ok) {
      const updated=await r.json();
      setOrders((current)=>current.map((order)=>order.id===id?{...order,...(updated.id?updated:{status:"CANCELLED"})}:order));
    } else {
      const result=await r.json();
      setMsg(result.error||"Unable to cancel order");
    }
  }
  async function close(id: string) {
    const position=positions.find((item)=>item.id===id);
    if(!position)return;
    if(position.providerName==='alpaca-paper'){
      const quote=items.find((item)=>item.id===position.instrumentId);
      if(!quote?.liveQuote){
        setMsg("A fresh provider quote is required before submitting a paper sell order.");
        return;
      }
      const response=await fetch('/api/orders',{
        method:'POST',
        headers:{'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},
        body:JSON.stringify({
          instrumentId:position.instrumentId,side:'SELL',type:'MARKET',quantity:position.quantity,
          expectedPrice:quote.price,observedAt:quote.updatedAt,
        }),
      });
      const result=await response.json();
      setMsg(response.ok?`Paper sell order ${String(result.status||'submitted').replaceAll('_',' ').toLowerCase()}.`:result.error||'Unable to submit sell order.');
      if(response.ok){
        const [orderResponse,positionResponse]=await Promise.all([fetch('/api/orders'),fetch('/api/positions')]);
        if(orderResponse.ok)setOrders(await orderResponse.json());
        if(positionResponse.ok)setPositions((await positionResponse.json()).map((item:PositionResponse)=>({...item,quantity:Number(item.quantity),entryPrice:Number(item.entryPrice),margin:Number(item.margin),instrument:{...item.instrument,price:Number(item.instrument.price)}})));
      }
      return;
    }
    const r = await fetch("/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ positionId: id }),
    });
    const j = await r.json();
    setMsg(r.ok ? "Position closed" : j.error || "Close failed");
    if (r.ok) setPositions((p) => p.filter((x) => x.id !== id));
  }
  return (
    <>
      <Nav />
      <main className="trade-terminal">
        <header className="account-heading"><div><span className="account-kicker">{accountMode==='LOADING'?translate('restoringAccountMode'):`${accountMode} ACCOUNT · ${translate('tradingWorkspace')}`}</span><h1>{translate('tradeMarkets')}</h1><p>{accountMode==='LOADING'?'Loading your active paper account.':accountMode==='REAL'?'Orders go to the shared Alpaca Paper account. Confirmed fills are attributed to your Aurevia user; wallet cash remains separate.':'DEMO orders use Aurevia’s internal practice feed.'}</p></div><span className={`status-pill ${accountMode==='REAL'?'mode-real':'mode-demo'}`}>{accountMode==='LOADING'?'RESTORING':accountMode==='REAL'?'REAL · ALPACA PAPER':'DEMO ACCOUNT'}</span></header>
        {(accountMode==='REAL'||accountMode==='DEMO')?<>
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="card min-h-[650px] p-5">
            <div className="trade-market-select" role="group" aria-label={translate('selectAnInstrument')}>
              {items.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => setSelected(i.id)}
                  className={`rounded-lg px-3 py-2 text-sm ${i.id === selected ? "bg-gold text-black" : "bg-white/5"}`}
                  aria-pressed={i.id === selected}
                >
                  {i.symbol}{" "}
                  {i.price.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </button>
              ))}
              {!items.length&&<p className="muted text-sm">{accountMode==="REAL"?"No supported instruments have a fresh provider quote.":"No trading instruments are currently available."}</p>}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="trade-chart-panel">
                <div className="trade-chart-header">
                  <div>
                    <span className="account-kicker">{cur?.symbol||translate('selectAnInstrument')}</span>
                    <p className="trade-last-price">{cur?.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:cur.price<10?4:2})||"—"}</p>
                    {accountMode==="REAL"&&cur?.liveQuote&&<span className="muted text-xs">Bid {cur.bid?.toLocaleString(undefined,{maximumFractionDigits:6})??"—"} · Ask {cur.ask?.toLocaleString(undefined,{maximumFractionDigits:6})??"—"}</span>}
                  </div>
                  <span className="status-pill">{accountMode==="REAL"?`${cur?.source||"PROVIDER UNAVAILABLE"} · WS ${streamStatus}`:translate('simulatedPrice')}</span>
                </div>
                {accountMode==="DEMO"&&<div className="sr-only">{translate('currentSimulatedPriceChart')}</div>}
                <div className="hidden">
                  <div className="mb-2 text-4xl font-black">
                  {cur?.price.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                  </div>
                </div>
                {accountMode==="REAL"?
                  <div className="trade-live-chart">
                    <div className="trade-chart-timeframes" role="group" aria-label="Chart timeframe">
                      {(["1d","5d","1m","3m","1y"] as TimeframeId[]).map(timeframe=><button type="button" key={timeframe} aria-pressed={chartTimeframe===timeframe} onClick={()=>setChartTimeframe(timeframe)}>{timeframe.toUpperCase()}</button>)}
                    </div>
                    {cur?.liveQuote?
                      <LivePriceChart candles={liveCandles} quote={cur.liveQuote} timeframe={chartTimeframe} loading={chartLoading} error={chartError}/>
                      :<p className="live-chart-message" role="status">{chartError||"Waiting for a fresh provider quote."}</p>}
                    <p className="trade-chart-note">{cur?.liveQuote?`Provider data · quote ${new Date(cur.liveQuote.updatedAt).toLocaleTimeString()}`:"No simulated market data is shown for REAL orders."}</p>
                  </div>
                  :<>
                    <PriceChart price={cur?.price ?? 0} />
                    <p className="trade-chart-note">{translate('internalSimulatedMarket')}</p>
                  </>}
              </div>
              <div className="trade-orderbook">
                <h3 className="font-bold">{accountMode==="REAL"?"Provider quote":translate('orderBook')} {accountMode==="DEMO"&&<small>{translate('demoFeedOnly')}</small>}</h3>
                {accountMode==="REAL"?
                  <div className="mt-3 space-y-3 text-xs">
                    <div className="flex justify-between text-loss"><span>Ask</span><b>{cur?.ask?.toLocaleString(undefined,{maximumFractionDigits:6})??"Unavailable"}</b></div>
                    <div className="flex justify-between text-profit"><span>Bid</span><b>{cur?.bid?.toLocaleString(undefined,{maximumFractionDigits:6})??"Unavailable"}</b></div>
                    <p className="muted">Provider quotes only; the DEMO order book is not available in REAL mode.</p>
                  </div>
                  :<div className="mt-3 text-xs">
                  {book.asks
                    ?.slice()
                    .reverse()
                    .map((x) => (
                      <div
                        key={x.price}
                        className="flex justify-between text-loss"
                      >
                        <span>{x.price.toFixed(6)}</span>
                        <span>{x.quantity}</span>
                      </div>
                    ))}
                  <div className="my-2 border-t border-white/10" />
                  {book.bids?.map((x) => (
                    <div
                      key={x.price}
                      className="flex justify-between text-profit"
                    >
                      <span>{x.price.toFixed(6)}</span>
                      <span>{x.quantity}</span>
                    </div>
                  ))}
                </div>
                }
              </div>
            </div>
          </section>
          <section className="card p-5">
            <div className="account-panel-title"><div><h2>{translate('orderTicket')}</h2><p className="account-panel-subtitle">{accountMode==='REAL'?'Alpaca Paper order · confirmed provider status':'DEMO order · practice execution'}</p></div><span className={`status-pill ${accountMode==='REAL'?'mode-real':'mode-demo'}`}>{accountMode==='REAL'?'ALPACA PAPER':'DEMO'}</span></div>
            <form onSubmit={place} className="space-y-3">
              <fieldset className="space-y-3">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={translate('orderSide')}>
              <button type="button" aria-pressed={side === "BUY"}
                onClick={() => setSide("BUY")}
                className={`btn ${side === "BUY" ? "bg-profit text-black" : "bg-white/5"}`}
              >
                {translate('buy')}
              </button>
              <button type="button" aria-pressed={side === "SELL"}
                onClick={() => setSide("SELL")}
                className={`btn ${side === "SELL" ? "bg-loss text-white" : "bg-white/5"}`}
              >
                {translate('sell')}
              </button>
            </div>
              <label className="account-label">{translate('orderType')}<select className="input" required value={type} onChange={(event) => setType(event.target.value as "MARKET"|"LIMIT"|"STOP")}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="STOP" disabled={accountMode==="REAL"&&cur?.assetType==="CRYPTO"}>Stop</option></select></label>
              <label className="account-label">{translate('quantity')}<input className="input" type="number" min="0.00000001" step="any" inputMode="decimal" required value={qty} onChange={(event) => setQty(event.target.value)} placeholder="0.00"/></label>
              {type !== "MARKET" && <label className="account-label">{type === "STOP" ? translate('stopPrice') : translate('limitPrice')}<input className="input" type="number" min="0.00000001" step="any" inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00"/></label>}
              <div className="trade-estimate" aria-live="polite"><div><span>Available Aurevia wallet · {accountMode}</span><b>{availableBalance===null?"Loading…":formatUsd(availableBalance)}</b></div>{accountMode==='REAL'&&<><div><span>Reserved for Paper orders</span><b>{formatUsd(paperReservedBalance)}</b></div><div><span>Available Paper buy allocation</span><b>{formatUsd(paperAvailableBalance)}</b></div></>}<div><span>{accountMode==='REAL'?'Estimated buy notional':'Estimated required cash'}</span><b>{cur?formatUsd(estimatedRequiredCash):"—"}</b></div>{accountMode==='DEMO'&&<div><span>{translate('estimatedFee')}</span><b>{cur?.takerFee===undefined?"Not configured":formatUsd(estimatedFee)}</b></div>}</div>
              <p className="trade-estimate-note">{accountMode==='REAL'?'Displayed quotes are estimates; Alpaca Paper determines actual fills and prices. Paper reservations do not debit the Aurevia wallet, and provider cash is not withdrawable.':'Quotes, order matching, positions, and P/L are for practice and isolated to your DEMO account.'}</p>
              <button type="submit" disabled={placing||!selected||!cur||(accountMode==="REAL"&&!cur.liveQuote)} className="btn w-full bg-gold text-black disabled:opacity-50">{placing?translate('submittingOrder'):translate('placeOrder',{side})}</button>
              </fieldset>
              {msg&&<p className="text-sm muted" role="status">{msg}</p>}
            </form>
            <div className="mt-6">
              <h3 className="font-bold">Open orders</h3>
              {orders.filter((o) => o.status === "OPEN"||o.status==="PARTIALLY_FILLED").length ? (
                orders
                  .filter((o) => o.status === "OPEN"||o.status==="PARTIALLY_FILLED")
                  .map((o) => (
                    <div
                      key={o.id}
                      className="flex justify-between border-b border-white/10 py-2 text-xs"
                    >
                      <span>
                        {o.instrument.symbol} {o.side} {o.type}{o.providerName==='alpaca-paper'?' · ALPACA PAPER':''}
                      </span>
                      <button type="button" onClick={() => cancel(o.id)} className="gold">
                        {translate('cancel')}
                      </button>
                    </div>
                  ))
              ) : (
                <p className="mt-2 muted text-sm">{translate('noOpenOrders')}</p>
              )}
            </div>
          </section>
        </div>
        <section className="card mt-4 p-5">
          <div className="account-panel-title"><div><h2>{translate('openPositions')}</h2><p className="account-panel-subtitle">{translate('unrealizedPnl')} · {accountMode==='REAL'?'REAL-side holdings from confirmed fills; paper valuation unavailable':'DEMO positions'}</p></div><span className="status-pill">{positions.length} open</span></div>
          {positions.length ? (
            <div className="mt-3 space-y-2">
              {positions.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3"
                >
                  <span>
                    {p.instrument.symbol} · {p.side} · {p.quantity}
                  </span>
                  <span className={pnl(p)===null?"muted":pnl(p)! >= 0 ? "text-profit" : "text-loss"}>
                    {pnl(p)===null?"P/L unavailable":`${pnl(p)! >= 0 ? "+" : ""}$${pnl(p)!.toFixed(2)}`}
                  </span>
                  <button type="button" disabled={p.providerName==='alpaca-paper'&&!items.some(item=>item.id===p.instrumentId&&item.liveQuote)} className="btn bg-loss disabled:opacity-50" onClick={() => void close(p.id)}>
                    {p.providerName==='alpaca-paper'?'Market sell':translate('close')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 muted">{translate('noOpenPositions')}</p>
          )}
        </section>
        <section className="account-panel card mt-4 p-5"><div className="account-panel-title"><div><h2>{translate('orderHistory')}</h2><p className="account-panel-subtitle">{translate('recentSubmittedOrders')}</p></div><RefreshCw size={17} className="gold" aria-hidden="true"/></div>
          {orders.length?<div className="account-table-wrap"><table className="account-table"><thead><tr><th>Instrument</th><th>Side</th><th>Type</th><th>Quantity</th><th>Limit / stop</th><th>Status</th></tr></thead><tbody>{orders.slice(0,20).map(order=><tr key={order.id}><td>{order.instrument.symbol}</td><td>{order.side}</td><td>{order.type}</td><td>{Number(order.quantity).toLocaleString()}</td><td>{order.type==='LIMIT'?Number(order.price||0).toLocaleString(undefined,{maximumFractionDigits:6}):order.type==='STOP'?Number(order.stopPrice||0).toLocaleString(undefined,{maximumFractionDigits:6}):translate('market')}</td><td><span className="status-pill">{order.providerName==='alpaca-paper'?'ALPACA PAPER · ':''}{order.providerStatus||order.status.replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div>:<div className="account-empty">{translate('noOrdersRecorded')}</div>}
        </section>
        </>:<div className="account-empty" role="status">{translate('restoringAccountSession')}</div>}
      </main>
    </>
  );
}
