import { useState, useEffect, useRef } from 'react'
import { 
  getAllStaffIncomeForDate,
  getIncomeForDay,
  getIncomeForMonth
} from '@/api/client'
import { connectStatistics, type WSClient } from '@/ws/client'

type DateRange = 'today' | 'specific-day' | 'month'

export default function EnhancedStatistics() {
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const wsClientRef = useRef<WSClient | null>(null)
  
  // Specific day
  const [selectedDay, setSelectedDay] = useState('')
  
  // Month selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Statistics data
  const [stats, setStats] = useState<any>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const loadStatistics = async () => {
    setLoading(true)
    try {
      let dateISO: string | undefined = undefined
      let response

      switch (dateRange) {
        case 'today':
          dateISO = new Date().toISOString().split('T')[0]
          response = await getAllStaffIncomeForDate(dateISO)
          console.log('📋 Full API Response:', response)
          break
        case 'specific-day':
          if (selectedDay) {
            response = await getIncomeForDay(selectedDay)
          }
          break
        case 'month':
          response = await getIncomeForMonth(selectedYear, selectedMonth)
          break
      }

      if (response && response.data) {
        // Calculate total stats from staff data
        const staffData = Array.isArray(response.data) ? response.data : []
        console.log('📊 Staff Data:', staffData)
        
        // Only set stats if we have actual data
        if (staffData.length > 0) {
          const totalStats = staffData.reduce((acc: any, staff: any) => ({
            totalSeatsBooked: acc.totalSeatsBooked + (staff.seatBookings || 0),
            totalSeatIncome: acc.totalSeatIncome + (Number(staff.seatIncome) || 0),
            totalDayPassesSold: acc.totalDayPassesSold + (staff.dayPassSales || 0),
            totalDayPassIncome: acc.totalDayPassIncome + (Number(staff.dayPassIncome) || 0),
            totalIncome: acc.totalIncome + (Number(staff.totalIncome) || 0)
          }), {
            totalSeatsBooked: 0,
            totalSeatIncome: 0,
            totalDayPassesSold: 0,
            totalDayPassIncome: 0,
            totalIncome: 0
          })
          console.log('📊 Total Stats:', totalStats)
          setStats({ totalStats, staffData })
        } else {
          // No data for this period
          setStats(null)
        }
      } else {
        // No response or null data
        setStats(null)
      }

    } catch (err) {
      console.error('Failed to load statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatistics()
  }, [dateRange])

  // WebSocket connection for real-time updates
  useEffect(() => {
    console.log('🔌 Setting up Statistics WebSocket connection...')
    
    const wsClient = connectStatistics({
      onOpen: () => {
        console.log('✅ Statistics WebSocket connected')
        setWsConnected(true)
      },
      onClose: () => {
        console.log('❌ Statistics WebSocket disconnected')
        setWsConnected(false)
      },
      onError: (error) => {
        console.error('Statistics WebSocket error:', error)
        setWsConnected(false)
      },
      onMessage: (message) => {
        console.log('📨 Statistics update received:', message)
        
        // Refresh statistics when we receive an update
        if (message.type === 'statistics_update' || 
            message.type === 'transaction_update' ||
            message.type === 'staff_income_update') {
          console.log('🔄 Auto-refreshing statistics...')
          loadStatistics()
        }
      }
    })
    
    wsClientRef.current = wsClient
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up Statistics WebSocket connection...')
      wsClient.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = () => {
    loadStatistics()
  }

  const incomeChartData = stats?.totalStats ? [
    { name: 'Revenus Sièges', value: Number(stats.totalStats.totalSeatIncome), color: '#3B82F6' },
    { name: 'Revenus Passes Jour', value: Number(stats.totalStats.totalDayPassIncome), color: '#10B981' }
  ] : []

  const staffChartData = stats?.staffData?.map((staff: any) => ({
    name: staff.staffName || staff.staffId,
    seats: staff.seatBookings || 0,
    seatIncome: Number(staff.seatIncome) || 0,
    dayPasses: staff.dayPassSales || 0,
    dayPassIncome: Number(staff.dayPassIncome) || 0,
    income: Number(staff.totalIncome) || 0
  })) || []

  return (
    <div className="space-y-4">
      {/* WebSocket Status Indicator */}
      <div className="mb-2">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          wsConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          {wsConnected ? 'Mise à jour en temps réel activée' : 'Connexion...'}
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="border rounded p-4">
        <h3 className="font-medium mb-3">Période d'Analyse</h3>
        
        <div className="grid grid-cols-3 gap-3 mb-3">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-2 rounded text-sm ${
              dateRange === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setDateRange('specific-day')}
            className={`px-3 py-2 rounded text-sm ${
              dateRange === 'specific-day' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Jour Spécifique
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-2 rounded text-sm ${
              dateRange === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Ce Mois
          </button>
        </div>

        {dateRange === 'specific-day' && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <button
              onClick={handleLoad}
              disabled={!selectedDay}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Charger
            </button>
          </div>
        )}

        {dateRange === 'month' && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Année</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                min="2020"
                max="2099"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Mois</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{new Date(2000, m-1).toLocaleString('fr', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLoad}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Charger
            </button>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Chargement...</div>}

      {!loading && stats?.totalStats && stats.totalStats.totalIncome > 0 && (
        <>
          {/* Summary Cards - Pure Income (Simple Calculation) */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-600">📊 Revenus Pur (Calcul Simple)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="border rounded p-3 bg-blue-50">
                <div className="text-xs text-gray-600">Total Sièges</div>
                <div className="text-xl font-semibold">{stats.totalStats.totalSeatsBooked}</div>
              </div>
              <div className="border rounded p-3 bg-blue-50">
                <div className="text-xs text-gray-600">Revenus Sièges</div>
                <div className="text-xl font-semibold">{Number(stats.totalStats.totalSeatIncome).toFixed(3)} TND</div>
              </div>
              <div className="border rounded p-3 bg-green-50">
                <div className="text-xs text-gray-600">Passes Jour</div>
                <div className="text-xl font-semibold">{stats.totalStats.totalDayPassesSold}</div>
              </div>
              <div className="border rounded p-3 bg-green-50">
                <div className="text-xs text-gray-600">Revenus Passes</div>
                <div className="text-xl font-semibold">{Number(stats.totalStats.totalDayPassIncome).toFixed(3)} TND</div>
              </div>
              <div className="border rounded p-3 bg-purple-50">
                <div className="text-xs text-gray-600">Revenus Totaux</div>
                <div className="text-2xl font-bold text-purple-700">{Number(stats.totalStats.totalIncome).toFixed(3)} TND</div>
              </div>
            </div>
          </div>

          {/* Income Breakdown Chart */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-3">Répartition des Revenus</h3>
            
            {incomeChartData.length > 0 && incomeChartData.some(item => item.value > 0) ? (
              <>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mb-4">
                  {incomeChartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-gray-600">{item.value.toFixed(3)} TND</span>
                    </div>
                  ))}
                </div>
                
                {/* Bar Chart */}
                <div className="flex items-end gap-2 h-40">
                  {incomeChartData.map((item, index) => {
                    const maxValue = Math.max(...incomeChartData.map(i => i.value))
                    const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-20 rounded-t transition-all duration-500 hover:opacity-80"
                          style={{ 
                            backgroundColor: item.color,
                            height: `${Math.max(percentage, 5)}%`,
                            minHeight: '20px'
                          }}
                          title={`${item.name}: ${item.value.toFixed(3)} TND`}
                        ></div>
                        <div className="text-xs text-gray-500 mt-2 text-center font-medium">
                          {item.value.toFixed(2)} TND
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-2">Aucune donnée disponible pour cette période</p>
                <p className="text-sm">Les graphiques apparaîtront ici une fois que les revenus seront enregistrés</p>
              </div>
            )}
          </div>

          {/* Staff Performance Table */}
          {staffChartData.length > 0 && (
            <div className="border rounded p-4">
              <h3 className="font-medium mb-3">Performance du Personnel</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium text-gray-700">Personnel</th>
                    <th className="py-2 px-3 font-medium text-gray-700 text-right">Sièges</th>
                    <th className="py-2 px-3 font-medium text-gray-700 text-right">Revenus Sièges</th>
                    <th className="py-2 px-3 font-medium text-gray-700 text-right">Passes Jour</th>
                    <th className="py-2 px-3 font-medium text-gray-700 text-right">Revenus Passes</th>
                    <th className="py-2 px-3 font-medium text-gray-700 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {staffChartData.map((staff: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{staff.name}</td>
                      <td className="py-2 px-3 text-right">{staff.seats}</td>
                      <td className="py-2 px-3 text-right">{staff.seatIncome.toFixed(3)} TND</td>
                      <td className="py-2 px-3 text-right">{staff.dayPasses}</td>
                      <td className="py-2 px-3 text-right">{staff.dayPassIncome.toFixed(3)} TND</td>
                      <td className="py-2 px-3 text-right font-semibold">{staff.income.toFixed(3)} TND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && stats?.totalStats && stats.totalStats.totalIncome === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">Aucune donnée disponible pour cette période</div>
          <div className="text-sm text-gray-400">
            Les statistiques apparaîtront ici une fois que les transactions seront enregistrées
          </div>
        </div>
      )}

      {!loading && !stats && (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">Aucune donnée disponible</div>
          <div className="text-sm text-gray-400">
            Les statistiques apparaîtront ici une fois que les transactions seront enregistrées
          </div>
        </div>
      )}
    </div>
  )
}
