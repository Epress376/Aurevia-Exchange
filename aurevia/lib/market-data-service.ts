import {getMarketHistory,getMarketQuote,type LiveMarketAsset,type TimeframeId} from '@/lib/live-market';
import {getInternalMarketHistory,getInternalMarketQuote} from '@/lib/internal-market-data';
import type {ServerConfiguration} from '@/lib/config/env';
import type {AlpacaStockDataOptions} from '@/lib/providers/alpaca-stock-market-data';

export function getAlpacaMarketDataOptions(execution:ServerConfiguration['execution']):AlpacaStockDataOptions|undefined{
	if(!execution.alpacaTradingConfigured)return undefined;
	return {apiKey:execution.alpacaTradingApiKey,apiSecret:execution.alpacaTradingApiSecret};
}

export async function getMarketQuoteWithFallback(asset:LiveMarketAsset,apiKey:string,alpacaData?:AlpacaStockDataOptions){
	try{
		return await getMarketQuote(asset,apiKey,alpacaData);
	}
	catch(error){
		console.warn(`Configured market quote providers are unavailable (${error instanceof Error?error.name:'UnknownError'}).`);
		return getInternalMarketQuote(asset);
	}
}

export async function getMarketHistoryWithFallback(asset:LiveMarketAsset,timeframe:TimeframeId,apiKey:string,alpacaData?:AlpacaStockDataOptions){
	try{
		return await getMarketHistory(asset,timeframe,apiKey,alpacaData);
	}catch(error){
		console.warn(`Configured market history providers are unavailable (${error instanceof Error?error.name:'UnknownError'}).`);
		return getInternalMarketHistory(asset,timeframe);
	}
}
