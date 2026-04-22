import { useState } from 'react'

const mockWorkshops = [
  { id: 1, title: 'React Fundamentals', description: 'Learn React basics', date: '2024-05-15', participants: 24 },
  { id: 2, title: 'TypeScript Mastery', description: 'Advanced TypeScript patterns', date: '2024-05-20', participants: 18 },
  { id: 3, title: 'Web Design Principles', description: 'UI/UX best practices', date: '2024-05-25', participants: 32 },
]

export default function WorkshopsPage() {
  const [workshops] = useState(mockWorkshops)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Available Workshops</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {workshops.map(workshop => (
          <div key={workshop.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{workshop.title}</h3>
              <p className="text-gray-600 mb-4">{workshop.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">📅 {workshop.date}</span>
                <span className="text-sm text-gray-500">👥 {workshop.participants}</span>
              </div>
              <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
