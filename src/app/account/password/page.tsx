'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { PageLayout, PageContent, TopBar, TopBarActions } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Input } from '@/components/ui';
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRules } from '@/lib/password-policy';

export default function AccountPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validationError = useMemo(() => {
    if (!newPassword) return null;
    return validatePasswordRules(newPassword);
  }, [newPassword]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Complete all password fields before saving.' });
      return;
    }

    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (currentPassword === newPassword) {
      setMessage({ type: 'error', text: 'Choose a new password that is different from your current password.' });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({ type: 'error', text: result?.error || 'Unable to change password right now.' });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Your password has been updated. Future sign-ins will use the new password.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout>
      <TopBar
        title="Change Password"
        subtitle="Update the password used to sign in to your account"
        actions={
          <TopBarActions>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">Back to Dashboard</Button>
            </Link>
          </TopBarActions>
        }
      />
      <PageContent className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Password Settings</CardTitle>
          </CardHeader>

          <div className="space-y-5">
            <Alert type="info" title="Password requirements">
              {PASSWORD_REQUIREMENTS_MESSAGE}
            </Alert>

            {message && (
              <Alert type={message.type} title={message.type === 'success' ? 'Password updated' : 'Unable to update password'}>
                {message.text}
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                id="current-password"
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
              <Input
                id="new-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                helperText={PASSWORD_REQUIREMENTS_MESSAGE}
                error={newPassword ? validationError || undefined : undefined}
              />
              <Input
                id="confirm-password"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                error={confirmPassword && confirmPassword !== newPassword ? 'Passwords do not match.' : undefined}
              />

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save new password'}
                </Button>
                <p className="text-sm text-gray-500">Your current session will stay signed in after the change.</p>
              </div>
            </form>
          </div>
        </Card>
      </PageContent>
    </PageLayout>
  );
}
