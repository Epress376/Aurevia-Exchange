import {afterEach,describe,expect,it,vi} from 'vitest';
import {getMarketAsset,getMarketQuote} from '../lib/live-market';
import {AlpacaStockMarketDataProvider} from '../lib/providers/alpaca-stock-market-data';

afterEach(()=>vi.unstubAllGlobals());

describe('Alpaca stock market data',()=>{
	it('reads IEX quotes, trades, and daily bars using server-side credentials',async()=>{
		const fetcher=vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({quote:{bp:189.9,ap:190.1,t:'2026-10-15T14:00:00Z'}}),{status:200}))
			.mockResolvedValueOnce(new Response(JSON.stringify({trade:{p:190,t:'2026-10-15T14:00:01Z'}}),{status:200}))
			.mockResolvedValueOnce(new Response(JSON.stringify({bars:[{t:'2026-10-14T20:00:00Z',o:180,h:191,l:179,c:188,v:1000},{t:'2026-10-15T14:00:00Z',o:188,h:192,l:187,c:190,v:500}]}),{status:200}));
		const provider=new AlpacaStockMarketDataProvider({apiKey:'paper-key',apiSecret:'paper-secret',fetcher});
		await expect(provider.getQuote('AAPL')).resolves.toEqual({symbol:'AAPL',price:190,bid:189.9,ask:190.1,previousClose:188,open:188,high:192,low:187,volume:500,updatedAt:'2026-10-15T14:00:01.000Z'});
		expect(fetcher.mock.calls.map(([url])=>url)).toEqual([
			'https://data.alpaca.markets/v2/stocks/AAPL/quotes/latest?feed=iex',
			'https://data.alpaca.markets/v2/stocks/AAPL/trades/latest?feed=iex',
			'https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=1Day&limit=2&feed=iex',
		]);
		expect(fetcher.mock.calls[0][1].headers).toEqual({'APCA-API-KEY-ID':'paper-key','APCA-API-SECRET-KEY':'paper-secret'});
	});

	it('maps documented historical bars and preserves unavailable volume',async()=>{
		const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({bars:[{t:'2026-10-15T14:00:00Z',o:188,h:192,l:187,c:190}]}),{status:200}));
		const provider=new AlpacaStockMarketDataProvider({apiKey:'paper-key',apiSecret:'paper-secret',fetcher});
		await expect(provider.getBars('AAPL','2026-10-15T00:00:00.000Z','2026-10-15T23:59:00.000Z','1Min')).resolves.toEqual([{time:'2026-10-15T14:00:00.000Z',open:188,high:192,low:187,close:190,volume:null}]);
		expect(fetcher.mock.calls[0][0]).toContain('timeframe=1Min');
	});

	it('does not reveal credentials when Alpaca rejects authentication',async()=>{
		const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:401}));
		const provider=new AlpacaStockMarketDataProvider({apiKey:'private-key-value',apiSecret:'private-secret-value',fetcher});
		await expect(provider.getQuote('AAPL')).rejects.toThrow('ALPACA_STOCK_MARKET_DATA_ERROR:401');
		await expect(provider.getQuote('AAPL')).rejects.not.toThrow(/private-key-value|private-secret-value/);
	});

	it('selects Alpaca for configured stock quotes and keeps the provider source visible',async()=>{
		const now=new Date().toISOString();
		const fetcher=vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({quote:{bp:189.9,ap:190.1,t:now}}),{status:200}))
			.mockResolvedValueOnce(new Response(JSON.stringify({trade:{p:190,t:now}}),{status:200}))
			.mockResolvedValueOnce(new Response(JSON.stringify({bars:[{t:'2026-10-14T20:00:00Z',o:180,h:191,l:179,c:188,v:1000},{t:now,o:188,h:192,l:187,c:190,v:500}]}),{status:200}));
		vi.stubGlobal('fetch',fetcher);
		const quote=await getMarketQuote(getMarketAsset('AAPL')!,'',{apiKey:'paper-key',apiSecret:'paper-secret'});
		expect(quote).toMatchObject({price:190,change:2,source:'Alpaca'});
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});