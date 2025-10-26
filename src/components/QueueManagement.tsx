import { useState, useEffect, useRef } from 'react'
import { 
  listQueueSummaries, 
  listQueue, 
  reorderQueue, 
  deleteQueueEntry,
  changeDestination,
  addVehicleToQueue,
  searchVehicles,
  getVehicleAuthorizedRoutes,
  getAllDestinations,
  getVehicleDayPass
} from '@/api/client'
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core'
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Summary = { 
  destinationId: string
  destinationName: string
  totalVehicles: number
  totalSeats: number
  availableSeats: number
  basePrice: number
}

type QueueEntry = {
  id: string
  vehicleId: string
  licensePlate: string
  availableSeats: number
  totalSeats: number
  queuePosition: number
  bookedSeats: number
  status?: string
  hasDayPass?: boolean
  dayPassStatus?: string
  destinationId?: string
  destinationName?: string
}

function DayPassBadge({ entry }: { entry: QueueEntry }) {
  if (!entry.dayPassStatus) return null

  const getBadgeConfig = () => {
    switch (entry.dayPassStatus) {
      case 'no_pass':
        return { text: 'Pas de pass', className: 'bg-red-100 text-red-800 border-red-200', icon: '❌' }
      case 'has_pass':
        return { text: 'Pass actif', className: 'bg-green-100 text-green-800 border-green-200', icon: '✅' }
      case 'recent_pass':
        return { text: 'Nouveau', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🆕' }
      default:
        return null
    }
  }

  const config = getBadgeConfig()
  if (!config) return null

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </div>
  )
}

function ActionMenu({ 
  entry,
  onRemove, 
  onChangeDestination
}: { 
  entry: QueueEntry
  onRemove: () => void
  onChangeDestination: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        title="Plus d'actions"
      >
        <div className="w-4 h-4 flex flex-col justify-center items-center">
          <div className="w-1 h-1 bg-gray-600 rounded-full mb-0.5"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full mb-0.5"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => {
                onRemove()
                setIsOpen(false)
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              🗑️ Retirer de la file
            </button>
            <button
              onClick={() => {
                onChangeDestination()
                setIsOpen(false)
              }}
              disabled={!entry.availableSeats || entry.availableSeats === 0}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                !entry.availableSeats || entry.availableSeats === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={!entry.availableSeats || entry.availableSeats === 0 ? 'Impossible de changer de destination lorsque complet' : 'Changer de destination'}
            >
              📍 Changer de destination
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeDestinationModal({
  isOpen,
  onClose,
  fromEntry,
  authorizedStations,
  onConfirm
}: {
  isOpen: boolean
  onClose: () => void
  fromEntry: QueueEntry | null
  authorizedStations: any[]
  onConfirm: (stationId: string, stationName: string) => void
}) {
  const [selectedStation, setSelectedStation] = useState('')

  if (!isOpen || !fromEntry) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Changer de destination</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Véhicule :</div>
            <div className="font-semibold">{fromEntry.licensePlate}</div>
            <div className="text-sm text-gray-500 mt-2">
              Position actuelle : {fromEntry.queuePosition}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner une nouvelle destination :
            </label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choisir une destination...</option>
              {authorizedStations.map((station: any) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.stationName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                console.log('Confirm button clicked', { selectedStation, authorizedStations })
                if (selectedStation) {
                  const station = authorizedStations.find(s => s.stationId === selectedStation)
                  console.log('Found station:', station)
                  if (station) {
                    console.log('Calling onConfirm with:', selectedStation, station.stationName)
                    onConfirm(selectedStation, station.stationName)
                  }
                }
              }}
              disabled={!selectedStation}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                selectedStation
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddVehicleModal({
  isOpen,
  onClose,
  vehicleSearchQuery,
  onSearchChange,
  searchResults,
  searching,
  searchError,
  selectedVehicle,
  onSelectVehicle,
  authorizedStations,
  selectedDestination,
  onDestinationSelect,
  onAddToQueue
}: any) {
  const [showDestinationSelection, setShowDestinationSelection] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {!selectedVehicle ? 'Rechercher un véhicule' : 
               !showDestinationSelection ? 'Sélectionner destination' : 
               'Confirmer l\'ajout'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Step 1: Search Vehicle */}
          {!selectedVehicle && (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Rechercher par plaque d'immatriculation..."
                  value={vehicleSearchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searching && <div className="text-sm text-gray-500 mt-2">Recherche...</div>}
                {searchError && <div className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">{searchError}</div>}
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {searchResults.map((vehicle: any) => (
                    <div
                      key={vehicle.id}
                      onClick={() => onSelectVehicle(vehicle)}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedVehicle?.id === vehicle.id ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{vehicle.licensePlate}</div>
                      <div className="text-xs text-gray-500">
                        Capacité: {vehicle.capacity} - {vehicle.isActive ? 'Actif' : 'Inactif'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </>
          )}

          {/* Step 2: Select Destination */}
          {selectedVehicle && !showDestinationSelection && (
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Véhicule sélectionné :</div>
                <div className="font-semibold">{selectedVehicle.licensePlate}</div>
                <div className="text-xs text-gray-500">
                  Capacité: {selectedVehicle.capacity} - {selectedVehicle.isActive ? 'Actif' : 'Inactif'}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner une destination autorisée :
                </label>
                {!authorizedStations || authorizedStations.length === 0 ? (
                  <div className="text-sm text-yellow-600 p-3 bg-yellow-50 rounded-lg">
                    Chargement des destinations autorisées...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {authorizedStations.map((station: any) => (
                      <div
                        key={station.stationId}
                        onClick={() => onDestinationSelect(station.stationId, station.stationName)}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedDestination?.stationId === station.stationId 
                            ? 'bg-blue-50 border-blue-500' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">{station.stationName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onSelectVehicle(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={() => setShowDestinationSelection(true)}
                  disabled={!selectedDestination || authorizedStations.length === 0}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                    selectedDestination && authorizedStations.length > 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Continuer
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirm */}
          {selectedVehicle && showDestinationSelection && (
            <>
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Véhicule :</div>
                <div className="font-semibold">{selectedVehicle.licensePlate}</div>
                <div className="text-sm text-gray-600 mt-2 mb-1">Destination :</div>
                <div className="font-semibold">{selectedDestination?.stationName}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDestinationSelection(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={onAddToQueue}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  Confirmer l'ajout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SortableQueueItem({ 
  entry,
  onRemove,
  onChangeDestination,
}: { 
  entry: QueueEntry
  onRemove: () => void
  onChangeDestination: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="border rounded p-3 mb-2 bg-white"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-move text-gray-400 hover:text-gray-600">
            ☰
          </div>
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
            {entry.queuePosition}
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {entry.licensePlate}
              <DayPassBadge entry={entry} />
            </div>
            <div className="text-xs text-gray-500">
              {entry.bookedSeats}/{entry.totalSeats} sièges réservés - {entry.availableSeats} disponibles
            </div>
          </div>
        </div>
        
        <ActionMenu
          entry={entry}
          onRemove={onRemove}
          onChangeDestination={onChangeDestination}
        />
      </div>
    </div>
  )
}

export default function QueueManagement() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [selected, setSelected] = useState<Summary | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(false)
  
  // Change destination modal state
  const [changeDestModalOpen, setChangeDestModalOpen] = useState(false)
  const [changeDestFromEntry, setChangeDestFromEntry] = useState<QueueEntry | null>(null)
  const [authorizedStations, setAuthorizedStations] = useState<any[]>([])
  
  // Add vehicle modal state
  const [addVehicleModalOpen, setAddVehicleModalOpen] = useState(false)
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [vehicleAuthorizedStations, setVehicleAuthorizedStations] = useState<any[]>([])
  const [selectedDestination, setSelectedDestination] = useState<{stationId: string; stationName: string} | null>(null)

  // Day pass checker state
  const [dayPassModalOpen, setDayPassModalOpen] = useState(false)
  const [dayPassSearchQuery, setDayPassSearchQuery] = useState('')
  const [dayPassSearchResults, setDayPassSearchResults] = useState<any[]>([])
  const [dayPassSearching, setDayPassSearching] = useState(false)
  const [dayPassSearchError, setDayPassSearchError] = useState<string | null>(null)
  const [selectedDayPassVehicle, setSelectedDayPassVehicle] = useState<any>(null)
  const [dayPassStatus, setDayPassStatus] = useState<{status: string; details: any} | null>(null)
  const [checkingDayPass, setCheckingDayPass] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadSummaries()
  }, [])

  useEffect(() => {
    if (selected) {
      loadQueue()
    }
  }, [selected])

  // F6 keyboard shortcut to open add vehicle modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F6') {
        event.preventDefault()
        // Only open if modal is not already open
        if (!addVehicleModalOpen) {
          setSelectedVehicle(null)
          setSelectedDestination(null)
          setVehicleSearchQuery('')
          setSearchResults([])
          setSearching(false)
          setSearchError(null)
          setVehicleAuthorizedStations([])
          setAddVehicleModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [addVehicleModalOpen])

  const loadSummaries = async () => {
    try {
      // Load all destinations and queue summaries
      const [destinationsResponse, summariesResponse] = await Promise.all([
        getAllDestinations(),
        listQueueSummaries()
      ])
      
      const allDests = destinationsResponse.data || []
      const queueSummaries = summariesResponse.data || []
      
      // Merge all destinations with queue data
      const mergedSummaries = allDests.map(dest => {
        const queueData = queueSummaries.find(q => q.destinationId === dest.id)
        return {
          destinationId: dest.id,
          destinationName: dest.name,
          totalVehicles: queueData?.totalVehicles || 0,
          totalSeats: queueData?.totalSeats || 0,
          availableSeats: queueData?.availableSeats || 0,
          basePrice: dest.basePrice
        }
      })
      
      setSummaries(mergedSummaries)
    } catch (error) {
      console.error('Failed to load queue summaries:', error)
    }
  }

  const loadQueue = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const response = await listQueue(selected.destinationId)
      // Handle empty response or null data
      const data = response.data || []
      const items = Array.isArray(data) ? data.map((e) => ({
        ...e,
        availableSeats: Number(e.availableSeats ?? 0),
        totalSeats: Number(e.totalSeats ?? 0),
        queuePosition: Number(e.queuePosition ?? 0),
        bookedSeats: Number(e.bookedSeats ?? 0),
        status: e.status,
        hasDayPass: e.hasDayPass ?? false,
        dayPassStatus: e.dayPassStatus ?? 'no_pass',
      })) as QueueEntry[] : []
      setQueue(items)
    } catch (error) {
      console.error('Failed to load queue:', error)
      setQueue([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!selected || !over || active.id === over.id) return

    const oldIndex = queue.findIndex((item) => item.id === active.id)
    const newIndex = queue.findIndex((item) => item.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newQueue = arrayMove(queue, oldIndex, newIndex)
      setQueue(newQueue)

      try {
        const entryIds = newQueue.map(item => item.id)
        await reorderQueue(selected.destinationId, entryIds)
        
        // Refresh queue data to get latest positions and data from backend
        await loadQueue()
        await loadSummaries()
      } catch (error) {
        console.error('Failed to reorder queue:', error)
        setQueue(queue)
      }
    }
  }

  const handleRemove = async (entry: QueueEntry) => {
    if (!selected) return
    if (!confirm(`Êtes-vous sûr de vouloir retirer ${entry.licensePlate} de la file ?`)) return
    
    try {
      await deleteQueueEntry(selected.destinationId, entry.id)
      loadQueue()
      loadSummaries()
    } catch (error) {
      console.error('Failed to remove queue entry:', error)
    }
  }

  const handleChangeDestination = async (entry: QueueEntry) => {
    console.log('Opening change destination for entry:', entry)
    setChangeDestFromEntry(entry)
    try {
      const response = await getVehicleAuthorizedRoutes(entry.vehicleId)
      console.log('Authorized stations loaded:', response.data)
      setAuthorizedStations(response.data)
      setChangeDestModalOpen(true)
    } catch (error) {
      console.error('Failed to load authorized stations:', error)
      setChangeDestModalOpen(false)
    }
  }

  const handleConfirmChangeDestination = async (stationId: string, stationName: string) => {
    console.log('handleConfirmChangeDestination called with:', stationId, stationName)
    
    if (!selected || !changeDestFromEntry) {
      console.error('Missing selected or changeDestFromEntry:', { selected, changeDestFromEntry })
      return
    }
    
    console.log('Changing destination:', {
      fromDestinationId: selected.destinationId,
      entryId: changeDestFromEntry.id,
      toStationId: stationId,
      toStationName: stationName
    })
    
    try {
      console.log('Calling changeDestination API...')
      await changeDestination(selected.destinationId, changeDestFromEntry.id, stationId, stationName)
      console.log('Destination changed successfully')
      setChangeDestModalOpen(false)
      setChangeDestFromEntry(null)
      setAuthorizedStations([])
      await loadQueue()
      await loadSummaries()
      console.log('Queue refreshed after destination change')
    } catch (error) {
      console.error('Failed to change destination:', error)
      alert('Erreur lors du changement de destination: ' + (error as any)?.message)
    }
  }

  const handleSearchVehicles = async (query: string) => {
    setVehicleSearchQuery(query)
    setSearchError(null)
    
    if (query.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const response = await searchVehicles(query)
      const results = response.data || []
      setSearchResults(results)
      
      // If we have a query but no results, show error
      if (query.length >= 2 && results.length === 0) {
        setSearchError("Aucun véhicule trouvé avec cette plaque d'immatriculation")
      }
    } catch (error) {
      console.error('Failed to search vehicles:', error)
      setSearchResults([])
      setSearchError("Erreur lors de la recherche. Veuillez réessayer.")
    } finally {
      setSearching(false)
    }
  }

  const handleSelectVehicle = async (vehicle: any) => {
    setSelectedVehicle(vehicle)
    setSelectedDestination(null)
    try {
      const response = await getVehicleAuthorizedRoutes(vehicle.id)
      setVehicleAuthorizedStations(response.data)
    } catch (error) {
      console.error('Failed to load authorized stations:', error)
    }
  }

  const handleDestinationSelect = (stationId: string, stationName: string) => {
    setSelectedDestination({ stationId, stationName })
  }

  const handleAddVehicle = async () => {
    if (!selectedVehicle || !selectedDestination) return
    
    try {
      await addVehicleToQueue(
        selectedDestination.stationId,
        selectedVehicle.id,
        selectedDestination.stationName
      )
      setAddVehicleModalOpen(false)
      setSelectedVehicle(null)
      setSelectedDestination(null)
      setVehicleSearchQuery('')
      setSearchResults([])
      setVehicleAuthorizedStations([])
      
      // Refresh the queue if we're currently viewing the destination we added to
      const targetSummary = summaries.find(s => s.destinationId === selectedDestination.stationId)
      if (targetSummary) {
        setSelected(targetSummary)
        // Load queue for that destination
        try {
          const response = await listQueue(selectedDestination.stationId)
          const items = (response.data as any[]).map((e) => ({
            ...e,
            availableSeats: Number(e.availableSeats ?? 0),
            totalSeats: Number(e.totalSeats ?? 0),
            queuePosition: Number(e.queuePosition ?? 0),
            bookedSeats: Number(e.bookedSeats ?? 0),
            status: e.status,
            hasDayPass: e.hasDayPass ?? false,
            dayPassStatus: e.dayPassStatus ?? 'no_pass',
          })) as QueueEntry[]
          setQueue(items)
        } catch (error) {
          console.error('Failed to refresh queue:', error)
        }
      }
      loadSummaries()
    } catch (error) {
      console.error('Failed to add vehicle to queue:', error)
    }
  }

  // Day pass checker handlers
  const handleDayPassSearch = async (query: string) => {
    setDayPassSearchQuery(query)
    setDayPassSearchError(null)
    
    if (query.length < 2) {
      setDayPassSearchResults([])
      setDayPassSearching(false)
      return
    }

    setDayPassSearching(true)
    try {
      const response = await searchVehicles(query)
      const results = response.data || []
      setDayPassSearchResults(results)
      
      if (query.length >= 2 && results.length === 0) {
        setDayPassSearchError("Aucun véhicule trouvé avec cette plaque d'immatriculation")
      }
    } catch (error) {
      console.error('Failed to search vehicles:', error)
      setDayPassSearchResults([])
      setDayPassSearchError("Erreur lors de la recherche. Veuillez réessayer.")
    } finally {
      setDayPassSearching(false)
    }
  }

  const handleDayPassVehicleSelect = (vehicle: any) => {
    setSelectedDayPassVehicle(vehicle)
    setDayPassStatus(null)
  }

  const handleCheckDayPassStatus = async () => {
    if (!selectedDayPassVehicle) return
    
    setCheckingDayPass(true)
    try {
      const response = await getVehicleDayPass(selectedDayPassVehicle.id)
      const dayPassData = response.data
      
      if (dayPassData && dayPassData.isActive) {
        // Check if it's paid: day pass exists AND vehicle has made at least one trip
        const isPaid = dayPassData.hasTrip || false
        setDayPassStatus({
          status: isPaid ? 'paid' : 'unpaid',
          details: dayPassData
        })
      } else {
        setDayPassStatus({
          status: 'no_pass',
          details: null
        })
      }
    } catch (error) {
      console.error('Failed to check day pass status:', error)
      setDayPassSearchError("Erreur lors de la vérification du passe journal. Veuillez réessayer.")
    } finally {
      setCheckingDayPass(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Global Actions */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await loadSummaries()
              if (selected) {
                await loadQueue()
              }
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            title="Actualiser toutes les données"
          >
            🔄 Actualiser
          </button>
          <button
            onClick={() => {
              setSelectedDayPassVehicle(null)
              setDayPassSearchQuery('')
              setDayPassSearchResults([])
              setDayPassSearching(false)
              setDayPassSearchError(null)
              setDayPassStatus(null)
              setDayPassModalOpen(true)
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm"
            title="Vérifier le statut du passe journal"
          >
            🎫 Vérifier Passe Jour
          </button>
        </div>
        <button
          onClick={() => {
            setSelectedVehicle(null)
            setSelectedDestination(null)
            setVehicleSearchQuery('')
            setSearchResults([])
            setSearching(false)
            setSearchError(null)
            setVehicleAuthorizedStations([])
            setAddVehicleModalOpen(true)
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        >
          ➕ Ajouter Véhicule
        </button>
      </div>

      {/* Destination summaries */}
      <div className="grid grid-cols-4 gap-3">
        {summaries.map((summary) => (
          <div
            key={summary.destinationId}
            onClick={() => setSelected(summary)}
            className={`border rounded p-3 cursor-pointer transition-colors ${
              selected?.destinationId === summary.destinationId
                ? 'bg-blue-50 border-blue-500'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="font-medium text-sm">{summary.destinationName}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.totalVehicles} véhicules - {summary.availableSeats} places dispo
            </div>
            <div className="text-xs font-medium mt-1">
              Prix: {summary.basePrice} TND
            </div>
          </div>
        ))}
      </div>

      {/* Queue display */}
      {selected && (
        <div className="border rounded p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              File d'attente: {selected.destinationName}
            </h3>
            <button
              onClick={async () => {
                await loadQueue()
                await loadSummaries()
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              title="Actualiser les données"
            >
              🔄 Actualiser
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun véhicule dans la file</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {queue.map((entry) => (
                    <SortableQueueItem
                      key={entry.id}
                      entry={entry}
                      onRemove={() => handleRemove(entry)}
                      onChangeDestination={() => handleChangeDestination(entry)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Change destination modal */}
      <ChangeDestinationModal
        isOpen={changeDestModalOpen}
        onClose={() => {
          setChangeDestModalOpen(false)
          setChangeDestFromEntry(null)
          setAuthorizedStations([])
        }}
        fromEntry={changeDestFromEntry}
        authorizedStations={authorizedStations}
        onConfirm={handleConfirmChangeDestination}
      />

      {/* Add vehicle modal */}
      <AddVehicleModal
        isOpen={addVehicleModalOpen}
        onClose={() => {
          setAddVehicleModalOpen(false)
          setSelectedVehicle(null)
          setSelectedDestination(null)
          setVehicleSearchQuery('')
          setSearchResults([])
          setSearching(false)
          setSearchError(null)
          setVehicleAuthorizedStations([])
        }}
        vehicleSearchQuery={vehicleSearchQuery}
        onSearchChange={handleSearchVehicles}
        searchResults={searchResults}
        searching={searching}
        searchError={searchError}
        selectedVehicle={selectedVehicle}
        onSelectVehicle={handleSelectVehicle}
        authorizedStations={vehicleAuthorizedStations}
        selectedDestination={selectedDestination}
        onDestinationSelect={handleDestinationSelect}
        onAddToQueue={handleAddVehicle}
      />

      {/* Day Pass Checker modal */}
      {dayPassModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {!selectedDayPassVehicle ? 'Rechercher un véhicule' : 
                   !dayPassStatus ? 'Vérifier le passe journal' : 
                   'Statut du passe journal'}
                </h2>
                <button
                  onClick={() => {
                    setDayPassModalOpen(false)
                    setSelectedDayPassVehicle(null)
                    setDayPassSearchQuery('')
                    setDayPassSearchResults([])
                    setDayPassSearching(false)
                    setDayPassSearchError(null)
                    setDayPassStatus(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Step 1: Search Vehicle */}
              {!selectedDayPassVehicle && (
                <>
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Rechercher par plaque d'immatriculation..."
                      value={dayPassSearchQuery}
                      onChange={(e) => handleDayPassSearch(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {dayPassSearching && <div className="text-sm text-gray-500 mt-2">Recherche...</div>}
                    {dayPassSearchError && <div className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">{dayPassSearchError}</div>}
                  </div>

                  {dayPassSearchResults.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                      {dayPassSearchResults.map((vehicle: any) => (
                        <div
                          key={vehicle.id}
                          onClick={() => handleDayPassVehicleSelect(vehicle)}
                          className={`p-3 border rounded cursor-pointer transition-colors ${
                            selectedDayPassVehicle?.id === vehicle.id ? 'bg-purple-50 border-purple-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{vehicle.licensePlate}</div>
                          <div className="text-xs text-gray-500">
                            Capacité: {vehicle.capacity} - {vehicle.isActive ? 'Actif' : 'Inactif'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDayPassModalOpen(false)
                        setSelectedDayPassVehicle(null)
                        setDayPassSearchQuery('')
                        setDayPassSearchResults([])
                        setDayPassSearching(false)
                        setDayPassSearchError(null)
                        setDayPassStatus(null)
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Check status or show result */}
              {selectedDayPassVehicle && !dayPassStatus && (
                <>
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Véhicule sélectionné :</div>
                    <div className="font-semibold">{selectedDayPassVehicle.licensePlate}</div>
                    <div className="text-xs text-gray-500">
                      Capacité: {selectedDayPassVehicle.capacity} - {selectedDayPassVehicle.isActive ? 'Actif' : 'Inactif'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedDayPassVehicle(null)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      onClick={handleCheckDayPassStatus}
                      disabled={checkingDayPass}
                      className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                        checkingDayPass
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      {checkingDayPass ? 'Vérification...' : 'Vérifier le statut'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Show result */}
              {selectedDayPassVehicle && dayPassStatus && (
                <>
                  <div className="mb-4 p-3 rounded-lg border-2">
                    {dayPassStatus.status === 'paid' && (
                      <div className="bg-green-50 border-green-500">
                        <div className="font-semibold text-green-700 mb-2">✅ Passe Jour PAYÉ</div>
                        <div className="text-sm text-gray-700">
                          <p>Le véhicule a effectué au moins un voyage après l'achat du passe journal.</p>
                          {dayPassStatus.details && (
                            <p className="mt-2 text-xs">
                              Acheté le: {new Date(dayPassStatus.details.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {dayPassStatus.status === 'unpaid' && (
                      <div className="bg-yellow-50 border-yellow-500">
                        <div className="font-semibold text-yellow-700 mb-2">⚠️ Passe Jour NON PAYÉ</div>
                        <div className="text-sm text-gray-700">
                          <p>Le passe journal a été acheté mais le véhicule n'a pas encore effectué de voyage ou a été récemment ajouté aux enregistrements de voyage.</p>
                          {dayPassStatus.details && (
                            <p className="mt-2 text-xs">
                              Acheté le: {new Date(dayPassStatus.details.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {dayPassStatus.status === 'no_pass' && (
                      <div className="bg-gray-50 border-gray-500">
                        <div className="font-semibold text-gray-700 mb-2">❌ Aucun passe journal</div>
                        <div className="text-sm text-gray-700">
                          <p>Ce véhicule n'a pas de passe journal actif pour aujourd'hui.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setDayPassStatus(null)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Vérifier un autre véhicule
                    </button>
                    <button
                      onClick={() => {
                        setDayPassModalOpen(false)
                        setSelectedDayPassVehicle(null)
                        setDayPassSearchQuery('')
                        setDayPassSearchResults([])
                        setDayPassSearching(false)
                        setDayPassSearchError(null)
                        setDayPassStatus(null)
                      }}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}