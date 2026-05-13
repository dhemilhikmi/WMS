interface AdminPlaceholderProps {
  title: string
  description?: string
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{title}</h1>

      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600 text-lg mb-4">{description || 'Coming soon...'}</p>
        <p className="text-gray-400">This section is under development</p>
      </div>
    </div>
  )
}
