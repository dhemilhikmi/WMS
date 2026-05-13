export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="bg-blue-600 text-white rounded-lg p-12 text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">WorkshopMu</h1>
        <p className="text-xl mb-8">Create, manage, and organize workshops with ease</p>
        <a href="/workshops" className="bg-white text-blue-600 px-8 py-3 rounded font-bold hover:bg-gray-100">
          Explore Workshops
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">📚 Learn</h3>
          <p className="text-gray-600">Discover and enroll in workshops tailored to your interests</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">👥 Connect</h3>
          <p className="text-gray-600">Network with like-minded individuals and instructors</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">🎯 Grow</h3>
          <p className="text-gray-600">Develop new skills and advance your career</p>
        </div>
      </div>
    </div>
  )
}
