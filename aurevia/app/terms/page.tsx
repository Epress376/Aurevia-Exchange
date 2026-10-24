import InfoPage from '@/components/InfoPage';

export default function Terms(){
  return <InfoPage eyebrow="Platform terms" title="Terms of use" lead="These product terms describe the current demo environment and should be replaced with reviewed terms before a public production launch." sections={[
    {title:'Demo platform',content:<p>Aurevia Invest currently provides an application demo for exploring account controls, simulated market information, and supported order flows. It is not a live brokerage, exchange, bank, custodian, or payment service.</p>},
    {title:'Account access',content:<p>Users are responsible for protecting their login credentials and using the account features only for authorized purposes. Administrator-only functions are restricted to accounts assigned the administrator role.</p>},
    {title:'Simulated services',content:<p>Market prices, order execution, order books, funding methods, balances, fees, and positions may be simulated within the application. No external venue or payment provider is connected; requests in the interface are not confirmations of external settlement.</p>},
    {title:'Use and risk',content:<p>Do not use demo output as a live quote, investment recommendation, or representation of future performance. Investing and trading involve risk, including possible loss of capital. Platform content is not individualized advice.</p>},
    {title:'Production readiness',content:<p>Before accepting real customers or funds, the operator must obtain applicable legal and compliance review, configure actual support and privacy contacts, and connect approved providers and controls appropriate to its business and jurisdictions.</p>},
  ]}/>;
}