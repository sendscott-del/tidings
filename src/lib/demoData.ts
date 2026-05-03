// Demo fixtures for Tidings — fake stake-message activity so trainers can
// walk through the app without exposing real recipient data.

export const TIDINGS_DEMO_DASHBOARD = {
  stakeContacts: 1284,
  unreadReplies: 7,
  optedOut: 23,
  messagesSent: 84,
}

function isoDaysAgo(d: number, h: number = 0): string {
  const t = new Date()
  t.setDate(t.getDate() - d)
  t.setHours(t.getHours() - h, 0, 0, 0)
  return t.toISOString()
}

export const TIDINGS_DEMO_RECENT = [
  {
    id: 'demo-msg-001',
    body: 'Reminder: Stake Conference this Sunday at 10am at the Stake Center. Translation available in Spanish.',
    recipient_count: 312,
    status: 'sent',
    sent_at: isoDaysAgo(0, 3),
    created_at: isoDaysAgo(0, 4),
  },
  {
    id: 'demo-msg-002',
    body: 'Bishopric training tonight at 7pm. Please bring your ward calendar.',
    recipient_count: 14,
    status: 'sent',
    sent_at: isoDaysAgo(2, 5),
    created_at: isoDaysAgo(2, 6),
  },
  {
    id: 'demo-msg-003',
    body: 'Service project Saturday — Smith family move from 9am. Trucks needed. Reply YES to volunteer.',
    recipient_count: 96,
    status: 'sent',
    sent_at: isoDaysAgo(4),
    created_at: isoDaysAgo(4, 1),
  },
  {
    id: 'demo-msg-004',
    body: 'Youth Conference registration is open. Talk to your YM/YW president for the link.',
    recipient_count: 78,
    status: 'sent',
    sent_at: isoDaysAgo(7),
    created_at: isoDaysAgo(7, 2),
  },
  {
    id: 'demo-msg-005',
    body: 'High Council meeting moved to 6:30pm Wednesday. Same room.',
    recipient_count: 14,
    status: 'sent',
    sent_at: isoDaysAgo(10),
    created_at: isoDaysAgo(10, 1),
  },
]

// Fake history entries — same shape as `messages` rows, used by the
// History page in demo mode.
export const TIDINGS_DEMO_HISTORY = [
  ...TIDINGS_DEMO_RECENT,
  {
    id: 'demo-msg-006',
    body: 'Temple recommend interview reminders — please confirm your appointment time with the Stake Clerk.',
    recipient_count: 41,
    status: 'sent',
    sent_at: isoDaysAgo(14),
    created_at: isoDaysAgo(14, 1),
  },
  {
    id: 'demo-msg-007',
    body: 'Welcome to our new ward members! We are so glad you are here.',
    recipient_count: 8,
    status: 'sent',
    sent_at: isoDaysAgo(18),
    created_at: isoDaysAgo(18, 1),
  },
  {
    id: 'demo-msg-008',
    body: 'Sister Johnson has been called and sustained as the new Relief Society President. Please welcome her.',
    recipient_count: 156,
    status: 'sent',
    sent_at: isoDaysAgo(22),
    created_at: isoDaysAgo(22, 1),
  },
]

// A few inbound replies so the Inbox isn't empty in demo mode.
export const TIDINGS_DEMO_INBOX = [
  {
    id: 'demo-in-001',
    from_phone: '+1555010-2031',
    from_name: 'Maria L.',
    body: 'YES — count me in for Saturday!',
    received_at: isoDaysAgo(0, 1),
    read_by: null,
    in_reply_to_message_id: 'demo-msg-003',
  },
  {
    id: 'demo-in-002',
    from_phone: '+1555010-4419',
    from_name: 'Kai S.',
    body: 'I\'ll bring my truck. Where should I meet?',
    received_at: isoDaysAgo(0, 2),
    read_by: null,
    in_reply_to_message_id: 'demo-msg-003',
  },
  {
    id: 'demo-in-003',
    from_phone: '+1555010-7708',
    from_name: 'David K.',
    body: 'STOP',
    received_at: isoDaysAgo(1, 4),
    read_by: 'demo-admin',
    in_reply_to_message_id: null,
  },
  {
    id: 'demo-in-004',
    from_phone: '+1555010-2031',
    from_name: 'Maria L.',
    body: 'Will translation be available at conference?',
    received_at: isoDaysAgo(1, 8),
    read_by: 'demo-admin',
    in_reply_to_message_id: 'demo-msg-001',
  },
]
