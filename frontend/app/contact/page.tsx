import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import CallbackRequestForm from "@/components/contact/CallbackRequestForm";
import { pageMetadata } from "@/lib/seo";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_DISPLAY } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact BoardingEdu | School Search Help",
  description:
    "Contact BoardingEdu by phone or email, or request a callback for school search and admission guidance.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="info-page contact-page">
      <nav className="school-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span aria-current="page">Contact Us</span>
      </nav>
      <section className="info-page__hero contact-page__hero">
        <span className="info-page__eyebrow">CONTACT BOARDINGEDU</span>
        <h1>Let&apos;s make your school search easier.</h1>
        <p>
          Have a question about finding a school or using the directory? Reach
          out to our team or leave your number and ask us to call.
        </p>
      </section>

      <section className="contact-page__options" aria-label="Contact options">
        <a className="contact-page__option" href={`mailto:${SITE_EMAIL}`}>
          <span className="contact-page__option-icon" aria-hidden="true">
            <Mail size={21} />
          </span>
          <span className="contact-page__option-label">EMAIL OUR TEAM</span>
          <strong>{SITE_EMAIL}</strong>
          <span className="contact-page__option-action">
            Send an email <ArrowRight size={15} aria-hidden="true" />
          </span>
        </a>
        <a className="contact-page__option" href={`tel:${SITE_PHONE}`}>
          <span className="contact-page__option-icon" aria-hidden="true">
            <Phone size={21} />
          </span>
          <span className="contact-page__option-label">CALL US</span>
          <strong>{SITE_PHONE_DISPLAY}</strong>
          <span className="contact-page__option-action">
            Call BoardingEdu <ArrowRight size={15} aria-hidden="true" />
          </span>
        </a>
      </section>

      <section className="contact-page__callback" aria-label="Request a callback">
        <div className="contact-page__callback-intro">
          <span className="info-page__eyebrow">PREFER A CALL?</span>
          <h2>We&apos;ll call you back.</h2>
          <p>
            Share just your name and phone number. Our team will follow up
            about your school search.
          </p>
        </div>
        <CallbackRequestForm titleId="contact-callback-title" />
      </section>
    </main>
  );
}
