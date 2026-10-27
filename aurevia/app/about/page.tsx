import InfoPage from '@/components/InfoPage';

export default function About(){
  return <InfoPage eyebrow="About the platform" title="A considered space to explore markets" lead="Aurevia Exchange brings account, market, and trading workflows together with clear distinctions between internal records, simulated activity, and paper-broker execution." updated="October 27, 2026" sections={[
    {title:'Platform overview',content:<p>The application brings market views, a trading workspace, wallet activity, and account settings into one interface. DEMO activity is simulated. When enabled and configured, REAL-mode eligible orders route to Alpaca Paper Trading, not a live brokerage.</p>},
    {title:'Designed for clarity',content:<p>Portfolio information and account activity are presented together so users can follow the state of their selected account. Market data sources are identified in the interface where available; internal ledger balances remain separate from any broker-reported paper account values.</p>},
    {title:'A paper-trading environment',content:<p>Aurevia Exchange is not a bank, custodian, live exchange, or investment adviser. The application does not provide personalized financial advice, and paper-trading results do not represent real investments or withdrawable cash.</p>},
  ]}/>;
}