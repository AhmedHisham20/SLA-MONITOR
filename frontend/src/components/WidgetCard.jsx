export default function WidgetCard({ title, value, subtitle, icon: Icon, color = 'blue', loading }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 bg-blue-50 text-blue-600',
    green: 'from-green-500 to-green-600 bg-green-50 text-green-600',
    red: 'from-red-500 to-red-600 bg-red-50 text-red-600',
    yellow: 'from-yellow-500 to-yellow-600 bg-yellow-50 text-yellow-600',
    purple: 'from-purple-500 to-purple-600 bg-purple-50 text-purple-600',
    indigo: 'from-indigo-500 to-indigo-600 bg-indigo-50 text-indigo-600',
  }
  const cc = colorClasses[color] || colorClasses.blue

  return (
    <div className="card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          {loading ? (
            <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mt-1.5" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1.5">{value ?? 'N/A'}</p>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${cc.split(' ')[2]} shadow-sm`}>
            <Icon className={`w-6 h-6 ${cc.split(' ')[3]}`} />
          </div>
        )}
      </div>
    </div>
  )
}
