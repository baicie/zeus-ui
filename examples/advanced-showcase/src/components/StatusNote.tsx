export interface StatusNoteProps {
  children: string
}

export function StatusNote({ children }: StatusNoteProps) {
  return <p className="event-output">{children}</p>
}
