import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Page Not Found</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            The page you requested does not exist or may have moved.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline">Administration</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
