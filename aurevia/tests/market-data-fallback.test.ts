import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
	finnhubQuote:vi.fn(),
	finnhubHistory:vi.fn(),
}));

vi.mock('@/lib/live-market',()=>({
	getMarketQuote:mocks.finnhubQuote,
	getMarketHistory:mocks.finnhubHistory,
}));
import {getMarketHistoryWithFallback,getMarketQuoteWithFallback} from '@/lib/market-data-service';

const asset={id:'AAPL',ticker:'AAPL',name:'Apple Inc.',type:'STOCK' as const,currency:'USD'};

beforeEach(()=>{
	mocks.finnhubQuote.mockReset();
	mocks.finnhubHistory.mockReset();
	vi.spyOn(console,'warn').mockImplementation(()=>undefined);
});
afterEach(()=>vi.restoreAllMocks());

describe('market-data provider boundaries',()=>{
	it('falls back to the internal market feed when no live provider is configured',async()=>{
		const liveQuote={asset,price:225,change:2,changePercent:0.9,updatedAt:new Date().toISOString(),source:'Finnhub',isStale:false};
		mocks.finnhubQuote.mockRejectedValue(new Error('No live market data provider is configured.'));
		await expect(getMarketQuoteWithFallback(asset,'')).resolves.toMatchObject({source:'Aurevia Internal',price:expect.any(Number)});
		expect(mocks.finnhubQuote).toHaveBeenCalledOnce();
		mocks.finnhubQuote.mockResolvedValueOnce(liveQuote);
		await expect(getMarketQuoteWithFallback(asset,'server-key')).resolves.toMatchObject({source:'Finnhub'});
	});

	it('uses a current Finnhub quote when available',async()=>{
		const liveQuote={asset,price:225,change:2,changePercent:0.9,updatedAt:new Date().toISOString(),source:'Finnhub',isStale:false};
		mocks.finnhubQuote.mockResolvedValue(liveQuote);
		await expect(getMarketQuoteWithFallback(asset,'server-key')).resolves.toBe(liveQuote);
	});

	it('falls back to internal quotes when provider responses fail',async()=>{
		mocks.finnhubQuote.mockRejectedValueOnce(new Error('provider offline'));
		await expect(getMarketQuoteWithFallback(asset,'server-key')).resolves.toMatchObject({source:'Aurevia Internal'});

		mocks.finnhubQuote.mockResolvedValueOnce({asset,price:225,source:'Finnhub',isStale:true});
		await expect(getMarketQuoteWithFallback(asset,'server-key')).resolves.toMatchObject({source:'Finnhub',isStale:true});
		expect(console.warn).toHaveBeenCalled();
	});

	it('falls back to internal history when provider history fails',async()=>{
		mocks.finnhubHistory.mockRejectedValue(new Error('provider offline'));
		await expect(getMarketHistoryWithFallback(asset,'1d','server-key')).resolves.toMatchObject({source:'Aurevia Internal'});
		expect(console.warn).toHaveBeenCalledOnce();
	});
});
