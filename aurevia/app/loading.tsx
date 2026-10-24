import Image from 'next/image';
export default function Loading(){return <main className="page-loading"><Image src="/aurevia-logo.png" alt="Aurevia" width={64} height={64} priority/><p>Loading Aurevia Exchange…</p></main>}
