import InfoPage from '@/components/InfoPage';

export default function Privacy(){
  return <InfoPage eyebrow="Your information" title="Privacy overview" lead="A plain-language summary of information handled by the current Aurevia Invest application." sections={[
    {title:'Information entered',content:<p>Account registration and profile forms can collect a name, email address, country, phone number, and the account password in hashed form. The verification form currently accepts legal name, date of birth, address, document type, and document number. Do not enter real identity details in this demo.</p>},
    {title:'How information is used',content:<p>Information is used by the application to authenticate users, display account details, associate ledger and trading records with an account, and allow administrators to review supported verification and funding requests.</p>},
    {title:'Storage and service providers',content:<p>Account and demo activity records are stored in the configured application database. The current implementation does not include secure identity-document uploads, an external verification provider, or a connected payment processor. A deployed service must document its actual retention, access, backup, and data-processing practices.</p>},
    {title:'Questions and formal policy',content:<p>This page is a product summary, not a jurisdiction-specific legal privacy notice. A production service should publish a reviewed privacy policy with its operating entity, contact channel, retention periods, legal bases, and applicable user rights before collecting real customer information.</p>},
  ]}/>;
}