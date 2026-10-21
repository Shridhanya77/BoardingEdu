import Link from "next/link";
import { ArrowRight, GraduationCap, House } from "lucide-react";

const categories = [
  {
    href: "/home?home_category=day-school",
    title: "Day Schools",
    text: "Explore schools where students travel home after class.",
    Icon: GraduationCap,
  },
  {
    href: "/home?home_category=boarding-schools",
    title: "Boarding Schools",
    text: "Explore day boarding and full boarding schools across India.",
    Icon: House,
  },
] as const;

export default function CategoryBrowse() {
  return (
    <section className="home-section category-browse" id="explore-categories" aria-labelledby="category-browse-heading">
      <div className="home-section__heading home-section__heading--centered">
        <div>
          <div className="section-eyebrow">EXPLORE BY CATEGORY</div>
          <h2 id="category-browse-heading">Find schools that match your child’s day</h2>
        </div>
      </div>
      <div className="category-browse__grid">
        {categories.map(({ href, title, text, Icon }) => (
          <Link className="category-browse__card" href={href} key={href}>
            <span className="category-browse__icon" aria-hidden>
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
            <span>
              Browse {title.toLowerCase()} <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
