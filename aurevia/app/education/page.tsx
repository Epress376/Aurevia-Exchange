import InfoPage from '@/components/InfoPage';

export default function Education(){
  return <InfoPage eyebrow="Learning center" title="Build market understanding" lead="Use these starting points to explore common investing concepts alongside Aurevia Invest's simulated account and trading experience." sections={[
    {title:'Start with the basics',content:<p>Learn how asset prices, order types, and portfolio allocations are commonly described. The application is a learning aid, not a substitute for independent research or professional advice.</p>},
    {title:'Understand risk',content:<p>Market prices can move unpredictably, and losses can exceed expectations. Consider time horizon, diversification, and your own financial circumstances before making real investment decisions.</p>},
    {title:'Practice in simulation',content:<p>Explore the dashboard, wallet, and trading screens using the demo environment. Simulated activity does not use real money and cannot predict how a live market or provider will behave.</p>},
  ]}/>;
}