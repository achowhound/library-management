import { useEffect, useMemo, useState } from 'react';

const REMINDER_DAYS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDaysLeft(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / DAY_IN_MS);
}

function DueReminderBanner() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLoans = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/api/reader/my-borrows', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch borrows');
        }

        const data = await response.json();
        setLoans(Array.isArray(data.loans) ? data.loans : []);
      } catch (fetchError) {
        setError(fetchError.message || 'Failed to load reminders');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, []);

  const dueSoonLoans = useMemo(
    () =>
      loans.filter((loan) => {
        if (loan.returnDate || !loan.dueDate) return false;
        const daysLeft = getDaysLeft(loan.dueDate);
        return daysLeft >= 0 && daysLeft <= REMINDER_DAYS;
      }),
    [loans]
  );

  if (loading || error || dueSoonLoans.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
      <p className="font-semibold text-yellow-800">
        到期提醒：您有 {dueSoonLoans.length} 本图书将在 {REMINDER_DAYS} 天内到期，请及时归还以避免逾期费用。
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-yellow-700">
        {dueSoonLoans.map((loan) => (
          <li key={loan.id}>
            《{loan.copy?.book?.title || '未知图书'}》- 截止日期 {new Date(loan.dueDate).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DueReminderBanner;
