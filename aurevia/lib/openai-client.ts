/**
 * Server-only OpenAI helper.
 * Set OPENAI_API_KEY and optional OPENAI_MODEL in environment (never NEXT_PUBLIC_*).
 */
export type OpenAiChatMessage={role:'system'|'user'|'assistant';content:string};

export function getOpenAiConfig(){
	const apiKey=process.env.OPENAI_API_KEY?.trim()||'';
	const model=process.env.OPENAI_MODEL?.trim()||'gpt-4o-mini';
	return {apiKey,model,enabled:Boolean(apiKey)};
}

export async function openAiChat(messages:OpenAiChatMessage[],options?:{temperature?:number;maxTokens?:number}){
	const {apiKey,model,enabled}=getOpenAiConfig();
	if(!enabled)return null;
	const response=await fetch('https://api.openai.com/v1/chat/completions',{
		method:'POST',
		headers:{
			'content-type':'application/json',
			authorization:`Bearer ${apiKey}`,
		},
		body:JSON.stringify({
			model,
			messages,
			temperature:options?.temperature??0.4,
			max_tokens:options?.maxTokens??700,
		}),
	});
	if(!response.ok){
		const text=await response.text().catch(()=>'');
		console.error('OpenAI request failed',response.status,text.slice(0,200));
		return null;
	}
	const data=await response.json() as {choices?:Array<{message?:{content?:string}}>};
	const content=data.choices?.[0]?.message?.content?.trim();
	return content||null;
}

export const NOVA_SYSTEM_PROMPT=`You are Nova, Aurevia Exchange platform support assistant.
Answer only about the Aurevia platform: accounts, DEMO/REAL modes, verification (KYC), tiers, wallet funding workflows, investments, markets navigation, and support processes.
Rules:
- Do not invent balances, approvals, transaction IDs, or verification outcomes.
- Do not give personalized investment advice or guarantee returns.
- If asked to change account status, approve funding, or bypass controls, explain that only authorized administrators can do that through the admin console.
- Keep answers concise and practical.
- If unsure, say so and suggest contacting support.`;

export const ADMIN_DRAFT_SYSTEM_PROMPT=`You are an assistant that drafts professional replies for Aurevia Exchange administrators.
Write clear, polite, factual support or review replies.
Rules:
- Do not invent account balances, approvals, or legal conclusions.
- Do not promise funding outcomes the admin has not decided.
- Keep a professional tone suitable for financial platform support.
- Output only the draft message body, no preamble.`;
