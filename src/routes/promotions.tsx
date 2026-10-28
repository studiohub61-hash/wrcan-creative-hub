import { createFileRoute } from '@tanstack/react-router';
import { Shell } from '@/components/Shell';
import { PromotionsHubSection } from '@/components/PromotionsHub';

export const Route = createFileRoute('/promotions')({
  head: () => ({
    meta: [
      { title: 'Promotions & Partnerships Hub — WRCAN' },
      { name: 'description', content: 'Promoter dashboard for catering and recruitment staff, and a donor & sponsor portal with impact metrics, contribution tiers and the sponsor wall.' },
      { property: 'og:title', content: 'Promotions & Partnerships Hub — WRCAN' },
      { property: 'og:description', content: 'Submit promotional work, track earnings, or partner with WRCAN as a donor or corporate sponsor.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: PromotionsHub,
});

function PromotionsHub() {
  return (
    <Shell title="Promotions & Partnerships" subtitle="Promoters · Donors · Sponsors">
      <PromotionsHubSection />
    </Shell>
  );
}
