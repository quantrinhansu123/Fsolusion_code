const STATUS_MAP = {
  pending:    { label: 'Đang chờ',   cls: 'bg-[#dae2fd] text-[#3e4850]' },
  in_progress:{ label: 'Đang làm',   cls: 'bg-[#b8dffe] text-[#006591]' },
  completed:  { label: 'Hoàn thành', cls: 'bg-[#e6f4ea] text-[#1e8e3e]' },
  overdue:    { label: 'Trễ hẹn',    cls: 'bg-[#ffdad6] text-[#ba1a1a]' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
