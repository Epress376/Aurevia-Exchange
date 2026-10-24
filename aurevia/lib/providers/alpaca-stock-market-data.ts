export type AlpacaStockDataOptions={apiKey:string;apiSecret:string;fetcher?:typeof fetch};

type AlpacaQuote={bp?:number;ap?:number;t?:string};
type AlpacaTrade={p?:number;t?:string};
type AlpacaBar={t?:string;o?:number;h?:number;l?:number;c?:number;v?:number};

export type AlpacaStockQuote={
	symbol:string;price:number;bid:number|null;ask:number|null;previousClose:number|null;
	open:number|null;high:number|null;low:number|null;volume:number|null;updatedAt:string;
};

export type AlpacaStockBar={time:string;open:number;high:number;low:number;close:number;volume:number|null};

function isRecord(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function finite(value:unknown):number|null{return typeof value==='number'&&Number.isFinite(value)?value:null}
function asTimestamp(value:unknown):string|null{if(typeof value!=='string')return null;const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null}

export class AlpacaStockMarketDataProvider{
	readonly name='Alpaca';
	private readonly options:AlpacaStockDataOptions;
	constructor(options:AlpacaStockDataOptions){this.options=options}

	async getQuote(symbol:string):Promise<AlpacaStockQuote>{
		const encoded=encodeURIComponent(symbol.toUpperCase());
		const [quotePayload,tradePayload,barsPayload]=await Promise.all([
			this.request(`/v2/stocks/${encoded}/quotes/latest?feed=iex`),
			this.request(`/v2/stocks/${encoded}/trades/latest?feed=iex`),
			this.request(`/v2/stocks/${encoded}/bars?timeframe=1Day&limit=2&feed=iex`),
		]);
		const quote=isRecord(quotePayload)&&isRecord(quotePayload.quote)?quotePayload.quote as AlpacaQuote:null;
		const trade=isRecord(tradePayload)&&isRecord(tradePayload.trade)?tradePayload.trade as AlpacaTrade:null;
		const bars=isRecord(barsPayload)&&Array.isArray(barsPayload.bars)?barsPayload.bars as AlpacaBar[]:[];
		const latest=bars.at(-1);
		const previous=bars.length>1?bars.at(-2):undefined;
		const price=finite(trade?.p);
		const updatedAt=asTimestamp(trade?.t);
		if(price===null||price<=0||!updatedAt)throw new Error('ALPACA_STOCK_MARKET_DATA_INVALID_TRADE');
		return {
			symbol:symbol.toUpperCase(),price,bid:finite(quote?.bp),ask:finite(quote?.ap),
			previousClose:finite(previous?.c),open:finite(latest?.o),high:finite(latest?.h),low:finite(latest?.l),
			volume:finite(latest?.v),updatedAt,
		};
	}

	async getBars(symbol:string,start:string,end:string,timeframe:string):Promise<AlpacaStockBar[]>{
		const encoded=encodeURIComponent(symbol.toUpperCase());
		const params=new URLSearchParams({start,end,timeframe,feed:'iex',limit:'1000'});
		const barsPayload=await this.request(`/v2/stocks/${encoded}/bars?${params}`);
		const bars=isRecord(barsPayload)&&Array.isArray(barsPayload.bars)?barsPayload.bars as AlpacaBar[]:null;
		if(!bars)throw new Error('ALPACA_STOCK_MARKET_DATA_INVALID_BARS');
		return bars.flatMap(bar=>{
			const time=asTimestamp(bar.t),open=finite(bar.o),high=finite(bar.h),low=finite(bar.l),close=finite(bar.c);
			if(!time||open===null||high===null||low===null||close===null)return [];
			return [{time,open,high,low,close,volume:finite(bar.v)}];
		});
	}

	async healthCheck(){
		await this.getQuote('AAPL');
		return {connected:true,checkedAt:new Date().toISOString()};
	}

	private async request(path:string):Promise<unknown>{
		let response:Response;
		try{
			response=await (this.options.fetcher??fetch)(`https://data.alpaca.markets${path}`,{
				headers:{'APCA-API-KEY-ID':this.options.apiKey,'APCA-API-SECRET-KEY':this.options.apiSecret},
				signal:AbortSignal.timeout(10_000),
			});
		}catch{throw new Error('ALPACA_STOCK_MARKET_DATA_UNAVAILABLE')}
		if(!response.ok)throw new Error(`ALPACA_STOCK_MARKET_DATA_ERROR:${response.status}`);
		try{return await response.json() as unknown}catch{throw new Error('ALPACA_STOCK_MARKET_DATA_INVALID_RESPONSE')}
	}
}