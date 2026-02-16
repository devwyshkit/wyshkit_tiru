import { getPartnerFromSession } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic'

import { CheckCircle2, Clock, FileText, Building2, CreditCard, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'business',
    title: 'Business details',
    description: 'Name, type, and address',
    icon: Building2,
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'PAN and GSTIN',
    icon: FileText,
  },
  {
    id: 'bank',
    title: 'Bank account',
    description: 'Payout account details',
    icon: CreditCard,
  },
  {
    id: 'verification',
    title: 'Verification',
    description: 'Document verification',
    icon: Shield,
  },
];

function getStepStatus(partner: Record<string, unknown>, stepId: string): 'completed' | 'pending' | 'in_progress' {
  switch (stepId) {
    case 'business':
      return partner.business_name && partner.business_type ? 'completed' : 'pending';
    case 'documents':
      return partner.pan_number && partner.gstin ? 'completed' : 'pending';
    case 'bank':
      return partner.payout_account_number && partner.payout_ifsc ? 'completed' : 'pending';
    case 'verification':
      if (partner.kyc_status === 'ACTIVE') return 'completed';
      if (partner.kyc_status === 'SUBMITTED' || partner.kyc_status === 'PENDING') return 'in_progress';
      return 'pending';
    default:
      return 'pending';
  }
}

export default async function PartnerSettingsPage() {
  const partner = await getPartnerFromSession();
  if (!partner) redirect('/partner/login');

  // If partner is already ACTIVE, redirect to dashboard
  const isActive = partner.kyc_status === 'ACTIVE' || partner.onboarding_status === 'ACTIVE';
  if (isActive) redirect('/partner/orders');

  const isVerified = partner.kyc_status === 'ACTIVE';
  const completedSteps = ONBOARDING_STEPS.filter(
    step => getStepStatus(partner as Record<string, unknown>, step.id) === 'completed'
  ).length;

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Store details and verification
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "size-12 rounded-full flex items-center justify-center",
              isVerified ? "bg-emerald-100" : "bg-amber-100"
            )}>
              {isVerified ? (
                <CheckCircle2 className="size-6 text-emerald-600" />
              ) : (
                <Clock className="size-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900">
                {isVerified ? 'Verified' : 'Verification pending'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isVerified
                  ? 'Your store is verified and can receive orders'
                  : `${completedSteps} of ${ONBOARDING_STEPS.length} steps completed`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ONBOARDING_STEPS.map((step) => {
          const status = getStepStatus(partner as Record<string, unknown>, step.id);
          const Icon = step.icon;

          return (
            <Card key={step.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center",
                    status === 'completed' ? "bg-emerald-50" :
                      status === 'in_progress' ? "bg-amber-50" : "bg-zinc-100"
                  )}>
                    <Icon className={cn(
                      "size-5",
                      status === 'completed' ? "text-emerald-600" :
                        status === 'in_progress' ? "text-amber-600" : "text-zinc-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900">
                        {step.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-zinc-50 text-zinc-500 border-zinc-200'
                        )}
                      >
                        {status === 'completed' ? 'Done' :
                          status === 'in_progress' ? 'In progress' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Store information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-600">Store name</span>
              <span className="text-sm font-medium text-zinc-900">
                {partner.display_name || partner.name}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-600">Business name</span>
              <span className="text-sm font-medium text-zinc-900">
                {partner.business_name || 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-600">City</span>
              <span className="text-sm font-medium text-zinc-900">
                {partner.city}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-600">Phone</span>
              <span className="text-sm font-medium text-zinc-900">
                {partner.whatsapp_number ?? (partner.whatsapp_phoneNumber != null ? String(partner.whatsapp_phoneNumber) : null) ?? 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-600">Email</span>
              <span className="text-sm font-medium text-zinc-900">
                {partner.email || 'Not set'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isVerified && (
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="py-4">
            <p className="text-sm text-blue-800">
              Verification usually takes 2-3 business days. You&apos;ll receive an email once approved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
