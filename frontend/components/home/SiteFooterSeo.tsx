import Image from "next/image";
import Link from "next/link";

export default function SiteFooterSeo() {
  return (
    <footer className="seo-footer" id="sitemap">
      <div className="seo-footer__cta">
        <div>
          <h2>Start your school search today — it&apos;s free.</h2>
          <p>Join 1M+ parents who found the perfect school through BoardingEdu.</p>
        </div>
        <div>
          <Link href="/#schools">Find Schools</Link>
          <Link href="/#counselling">Free Counselling</Link>
        </div>
      </div>

      <div className="seo-footer__grid">
        <div className="seo-footer__brand">
          <div className="seo-footer__mark">BE</div>
          <Image
            className="brand__image"
            src="/BoardingEdu_LOGO.jpeg"
            alt="BoardingEdu"
            width={48}
            height={48}
          />
          <strong>BoardingEdu</strong>
          <span>India&apos;s #1 School Platform</span>
          <p>
            Connecting over 1 million parents with 12,000+ verified schools across India and
            abroad.
          </p>
          <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a>
          <a href="tel:+918046110000">+91 80-4611-0000</a>
        </div>

        <div>
          <h3>Discover</h3>
          <Link href="/#schools">Find Boarding Schools</Link>
          <Link href="/#schools">Find Day Schools</Link>
          <Link href="/compare">Compare Schools</Link>
          <Link href="/#featured">School Profiles</Link>
          <Link href="/#how-it-works">Admission Guides</Link>
          <Link href="/#why-us">Fee Planner</Link>
        </div>
        <div>
          <h3>Counselling</h3>
          <Link href="/#counselling">Free Counselling</Link>
          <Link href="/#schools">CBSE Board Guide</Link>
          <Link href="/#schools">IB Board Guide</Link>
          <Link href="/#schools">ICSE Board Guide</Link>
          <Link href="/#how-it-works">Admission Timeline</Link>
          <Link href="/#counselling">Scholarship Guide</Link>
        </div>
        <div>
          <h3>For Parents</h3>
          <Link href="/signup">Create Free Account</Link>
          <Link href="/login">Parent Login</Link>
          <Link href="/compare">My Shortlist</Link>
          <Link href="/#featured">Enquire Schools</Link>
          <Link href="/login">Track Applications</Link>
        </div>
        <div>
          <h3>For Schools</h3>
          <Link href="/signup">List Your School</Link>
          <Link href="/login">School Login</Link>
          <Link href="/login">Admin Dashboard</Link>
          <Link href="/login">Manage Enquiries</Link>
          <Link href="/#for-schools">Marketing Solutions</Link>
        </div>
        <div>
          <h3>Company</h3>
          <Link href="/#why-us">About BoardingEdu</Link>
          <Link href="/#why-us">Our Mission</Link>
          <Link href="/#faq">Press & Media</Link>
          <Link href="/#counselling">Careers</Link>
          <Link href="/#counselling">Contact Us</Link>
          <Link href="/#faq">Blog</Link>
        </div>
      </div>

      <div className="seo-footer__badges">
        <span>🆓 Free for Parents</span>
        <span>🏆 #1 Admission Platform</span>
        <span>📞 24/7 Counselling Support</span>
      </div>
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <Link href="/grievance">Grievance Policy</Link>
          <Link href="/sitemap">Sitemap</Link>
        </nav>
      </div>
    </footer>
  );
}
