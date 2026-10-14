import Image from 'next/image';
import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer>
      <div className="footer-top">
        <Link className="brand" href="/">
          <Image src="/logo.png" alt="" width={42} height={67} />
          <span>FK KOŠICKÁ<br />NOVÁ VES</span>
        </Link>
        <p>Jedna štvrť. Jeden klub.<br /><strong>Spolu píšeme ďalšiu kapitolu.</strong></p>
        <Link className="btn outline" href="/klub/kontakt">Kontaktujte nás ↗</Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} FK Košická Nová Ves</span>
        <Link href="/klub/zverejnovanie">Zverejňovanie</Link>
        <Link href="/klubovy-portal">O portáli a aplikácii</Link>
        <Link href="/dokumenty/ochrana-osobnych-udajov">Ochrana osobných údajov</Link>
      </div>
    </footer>
  );
}
