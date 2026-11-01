import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const n = brand.legalName;
  return (
    <LegalPage
      title="Terms of service"
      intro={`These terms cover your use of the ${n} client delivery rooms at ${brand.siteUrl.replace("https://", "")}. By creating an account or opening a room, you agree to them.`}
    >
      <section>
        <h2>The service</h2>
        <p>
          {n} uses delivery rooms to share photos and videos with clients so they can view, approve, request changes on,
          comment on, and download their files. The service is provided as part of the work we do for you.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate information and keep your password private.</li>
          <li>You are responsible for activity on your account, including approvals and comments.</li>
          <li>Room links are private to you and your team. Please do not share them publicly.</li>
        </ul>
      </section>

      <section>
        <h2>Your files and usage rights</h2>
        <p>
          Ownership of and permission to use delivered photos and videos are set by your agreement or invoice with {n}.
          Unless that agreement says otherwise, {n} keeps the copyright and may show the work in its portfolio, and you
          receive the usage rights you paid for. An approval in a room confirms that a file is final for delivery.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not try to access rooms or accounts that are not yours, interfere with the service, or upload or post anything
          unlawful or abusive. We may suspend access that breaks these terms.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          We work to keep rooms online and files safe, but the service is provided “as is”. Rooms can expire or be archived
          after delivery, so please download the files you want to keep.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the extent the law allows, {n} is not liable for indirect or consequential losses from using the service, and
          our total liability for the service is limited to the amount you paid us for the related project.
        </p>
      </section>

      <section>
        <h2>Changes and governing law</h2>
        <p>
          We may update these terms and will change the date at the top of this page when we do. These terms are governed by
          the laws of the State of California, and disputes will be handled in Kern County, California.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          How we handle your information is explained in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
