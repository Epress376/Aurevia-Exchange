import InfoPage from '@/components/InfoPage';

export default function About(){
  return <InfoPage eyebrow="About the platform" title="A considered space to explore markets" lead="Aurevia Invest is a simulated investing interface built to make market workflows easier to explore, from account setup through portfolio review." sections={[
    {title:'Platform overview',content:<p>The application brings market views, a trading workspace, wallet activity, and account settings into one interface. Its account and transaction flows are provided for demonstration and do not connect to real funds or external execution.</p>},
    {title:'Designed for clarity',content:<p>Portfolio information and account activity are presented together so users can follow the state of a simulated account. Clear labels distinguish platform information from actions that would require an external provider in a live service.</p>},
    {title:'A demo environment',content:<p>Market values and funding workflows in this deployment are simulated. Aurevia Invest is not a broker, custodian, bank, or investment adviser, and this application does not provide personalized financial advice.</p>},
  ]}/>;
}