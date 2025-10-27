import { useState, useEffect, useRef, useCallback } from 'react'
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
  getVehicleDayPass,
  getStaffInfo,
  listTodayTrips
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
import { printerService, TicketData } from '@/services/printerService'
import PrinterStatusDisplay from './PrinterStatusDisplay'

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
  
  // Notification state
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null)
  
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }
  
  // Change destination modal state
  const [changeDestModalOpen, setChangeDestModalOpen] = useState(false)
  const [changeDestFromEntry, setChangeDestFromEntry] = useState<QueueEntry | null>(null)
  const [authorizedStations, setAuthorizedStations] = useState<any[]>([])
  const [searchVehiclesQuery, setSearchVehiclesQuery] = useState('')
  // Add vehicle state (always visible, not modal)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [vehicleAuthorizedStations, setVehicleAuthorizedStations] = useState<any[]>([])
  const [selectedDestination, setSelectedDestination] = useState<{stationId: string; stationName: string} | null>(null)
  const [addingVehicle, setAddingVehicle] = useState(false)

  // Day pass checker state
  const [dayPassModalOpen, setDayPassModalOpen] = useState(false)
  const [dayPassSearchQuery, setDayPassSearchQuery] = useState('')
  const [dayPassSearchResults, setDayPassSearchResults] = useState<any[]>([])
  const [dayPassSearching, setDayPassSearching] = useState(false)
  const [dayPassSearchError, setDayPassSearchError] = useState<string | null>(null)
  const [selectedDayPassVehicle, setSelectedDayPassVehicle] = useState<any>(null)
  const [dayPassStatus, setDayPassStatus] = useState<{status: string; details: any} | null>(null)
  const [checkingDayPass, setCheckingDayPass] = useState(false)
  const dayPassSearchTimeoutRef = useRef<NodeJS.Timeout>()

  // Exit pass printer state
  const [exitPassModalOpen, setExitPassModalOpen] = useState(false)
  const [trips, setTrips] = useState<any[]>([])
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [tripsSearch, setTripsSearch] = useState('')
  const [printingTripIds, setPrintingTripIds] = useState<Set<string>>(new Set())
  const tripsSearchTimeoutRef = useRef<NodeJS.Timeout>()

  // Day pass printer state
  const [dayPassPrinterModalOpen, setDayPassPrinterModalOpen] = useState(false)
  const [dayPassesToPrint, setDayPassesToPrint] = useState<any[]>([])
  const [loadingDayPasses, setLoadingDayPasses] = useState(false)
  const [dayPassPrinterSearch, setDayPassPrinterSearch] = useState('')
  const [printingDayPassVehicleIds, setPrintingDayPassVehicleIds] = useState<Set<string>>(new Set())
  const dayPassPrinterTimeoutRef = useRef<NodeJS.Timeout>()

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


  // Day Pass modal - reset search and cleanup
  useEffect(() => {
    if (dayPassModalOpen) {
      setDayPassSearchQuery('')
    }
    
    return () => {
      if (dayPassSearchTimeoutRef.current) {
        clearTimeout(dayPassSearchTimeoutRef.current)
      }
    }
  }, [dayPassModalOpen])

  // Exit Pass modal - reset search and cleanup
  useEffect(() => {
    if (exitPassModalOpen) {
      setTripsSearch('')
    }
    
    return () => {
      if (tripsSearchTimeoutRef.current) {
        clearTimeout(tripsSearchTimeoutRef.current)
      }
    }
  }, [exitPassModalOpen])

  // Day Pass Printer modal - reset search and cleanup
  useEffect(() => {
    if (dayPassPrinterModalOpen) {
      setDayPassPrinterSearch('')
    }
    
    return () => {
      if (dayPassPrinterTimeoutRef.current) {
        clearTimeout(dayPassPrinterTimeoutRef.current)
      }
    }
  }, [dayPassPrinterModalOpen])

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
      showNotification('✅ Destination changée avec succès', 'success')
    } catch (error) {
      console.error('Failed to change destination:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      showNotification(`❌ Erreur changement destination: ${errorMsg}`, 'error')
    }
  }

  const handleSearchVehicles = async (query: string) => {
    if (query.length === 0) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    setSearching(true)
    
    try {
      const response = await searchVehicles(query)
      setSearchResults(response.data || [])
      setSearchError(null)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setSearchError("Erreur")
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

  const resetAddVehicleForm = () => {
    setSelectedVehicle(null)
    setSelectedDestination(null)
    setVehicleAuthorizedStations([])
    setSearchResults([])
    setSearchError(null)
    setAddingVehicle(false)
    // Keep the query and searching state - let the user keep typing
  }

  const handleAddVehicle = async () => {
    if (!selectedVehicle || !selectedDestination) return
    
    const destinationId = selectedDestination.stationId
    const destinationName = selectedDestination.stationName
    const vehicleId = selectedVehicle.id
    
    // Reset form FIRST - this unblocks the input immediately
    resetAddVehicleForm()
    
    try {
      const response = await addVehicleToQueue(destinationId, vehicleId, destinationName)
      
      const staffInfo = getStaffInfo()
      const staffName = staffInfo ? `${staffInfo.firstName} ${staffInfo.lastName}` : 'Unknown'
      
      if (response.data?.dayPassStatus === "created" && response.data?.dayPass) {
        const dayPassData = response.data.dayPass
        const ticketData: TicketData = {
          licensePlate: dayPassData.licensePlate || selectedVehicle.licensePlate,
          destinationName: destinationName,
          seatNumber: 0,
          totalAmount: 0,
          basePrice: 0,
          createdBy: staffName,
          createdAt: new Date().toISOString(),
          stationName: "Station",
          routeName: dayPassData.destinationName,
          staffFirstName: staffInfo?.firstName || '',
          staffLastName: staffInfo?.lastName || '',
        }
        
        try {
          await printerService.printDayPassTicket(ticketData)
          showNotification('✅ Véhicule ajouté avec pass journalier imprimé', 'success')
        } catch (printError) {
          console.error('Print error:', printError)
          const errorMsg = printError instanceof Error ? printError.message : String(printError)
          showNotification(`❌ Erreur impression: ${errorMsg}`, 'error')
        }
      } else {
        showNotification('✅ Véhicule ajouté avec succès!', 'success')
      }
      
      // Refresh everything
      await loadSummaries()
      if (selected) {
        const targetSummary = summaries.find(s => s.destinationId === destinationId)
        if (targetSummary) {
          setSelected(targetSummary)
          const response = await listQueue(destinationId)
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
        }
      }
    } catch (error) {
      console.error('Failed to add vehicle:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      showNotification(`❌ Erreur ajout véhicule: ${errorMsg}`, 'error')
    }
  }

  // Day pass checker handlers
  const handleDayPassSearch = useCallback(async (query: string) => {
    setDayPassSearchError(null)
    
    if (query.length === 0) {
      setDayPassSearchResults([])
      setDayPassSearching(false)
      return
    }

    setDayPassSearching(true)
    try {
      const response = await searchVehicles(query)
      const results = response.data || []
      setDayPassSearchResults(results)
      
      if (results.length === 0 && query.length > 0) {
        setDayPassSearchError("Aucun véhicule trouvé avec cette plaque d'immatriculation")
      }
    } catch (error) {
      console.error('Failed to search vehicles:', error)
      setDayPassSearchResults([])
      setDayPassSearchError("Erreur lors de la recherche. Veuillez réessayer.")
    } finally {
      setDayPassSearching(false)
    }
  }, [])

  const handleDayPassSearchChange = useCallback((query: string) => {
    setDayPassSearchQuery(query)
    
    if (dayPassSearchTimeoutRef.current) {
      clearTimeout(dayPassSearchTimeoutRef.current)
    }

    if (query.length === 0) {
      handleDayPassSearch('')
      return
    }

    dayPassSearchTimeoutRef.current = setTimeout(() => {
      handleDayPassSearch(query)
    }, 50)
  }, [handleDayPassSearch])

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
      
      console.log('Day pass data:', dayPassData)
      
      // If dayPassData exists, it means there's a valid day pass
      if (dayPassData) {
        setDayPassStatus({
          status: 'paid',
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

  // Exit pass handler
  const handleExitPassSearch = useCallback(async (query: string) => {
    setLoadingTrips(true)
    try {
      const response = await listTodayTrips(query.trim())
      setTrips(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to search trips:', error)
      setTrips([])
    } finally {
      setLoadingTrips(false)
    }
  }, [])

  const handleExitPassSearchChange = useCallback((query: string) => {
    setTripsSearch(query)
    
    if (tripsSearchTimeoutRef.current) {
      clearTimeout(tripsSearchTimeoutRef.current)
    }

    if (query.length === 0) {
      // Load all trips if search is empty
      handleExitPassSearch('')
      return
    }

    tripsSearchTimeoutRef.current = setTimeout(() => {
      handleExitPassSearch(query)
    }, 50)
  }, [handleExitPassSearch])

  const handlePrintExitPass = async (trip: any, tripIndex: number) => {
    const tripId = trip.id || trip.licensePlate
    
    // Add to printing set
    setPrintingTripIds(prev => new Set(prev).add(tripId))
    
    try {
      const staffInfo = getStaffInfo()
      const staffName = staffInfo ? `${staffInfo.firstName} ${staffInfo.lastName}` : 'Unknown'
      
      const exitPassTicketData: TicketData = {
        licensePlate: trip.licensePlate,
        destinationName: trip.destinationName,
        seatNumber: trip.seatsBooked || 0,
        totalAmount: trip.seatsBooked && trip.basePrice ? trip.seatsBooked * trip.basePrice : 0,
        basePrice: trip.basePrice || 0,
        createdBy: staffName,
        createdAt: trip.startTime || new Date().toISOString(),
        stationName: 'Station',
        routeName: trip.destinationName,
        vehicleCapacity: trip.vehicleCapacity,
        exitPassCount: tripIndex + 1,
        staffFirstName: staffInfo?.firstName || '',
        staffLastName: staffInfo?.lastName || '',
      };
      
      // Print the exit pass ticket
      await printerService.printExitPassTicket(exitPassTicketData)
      
      showNotification(`✅ Laissez-passer imprimé: ${trip.licensePlate}`, 'success')
      
      // Close modal after successful print
      setExitPassModalOpen(false)
      setTrips([])
    } catch (error) {
      console.error('Failed to print exit pass for trip:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      showNotification(`❌ Erreur impression laissez-passer: ${errorMsg}`, 'error')
    } finally {
      // Remove from printing set
      setPrintingTripIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(tripId)
        return newSet
      })
    }
  }

  // Day pass printer handler
  const handleDayPassPrinterSearch = useCallback(async (query: string) => {
    setLoadingDayPasses(true)
    try {
      // Search for vehicles
      const vehiclesResponse = await searchVehicles(query.trim())
      const vehicles = vehiclesResponse.data || []
      
      // For each vehicle, check if they have a day pass
      const vehiclesWithDayPass = []
      for (const vehicle of vehicles) {
        try {
          const dayPassResponse = await getVehicleDayPass(vehicle.id)
          if (dayPassResponse.data) {
            vehiclesWithDayPass.push({
              ...vehicle,
              dayPass: dayPassResponse.data
            })
          }
        } catch (error) {
          // No day pass for this vehicle
        }
      }
      
      setDayPassesToPrint(vehiclesWithDayPass)
    } catch (error) {
      console.error('Failed to search day passes:', error)
      setDayPassesToPrint([])
    } finally {
      setLoadingDayPasses(false)
    }
  }, [])

  const handleDayPassPrinterSearchChange = useCallback((query: string) => {
    setDayPassPrinterSearch(query)
    
    if (dayPassPrinterTimeoutRef.current) {
      clearTimeout(dayPassPrinterTimeoutRef.current)
    }

    if (query.length === 0) {
      handleDayPassPrinterSearch('')
      return
    }

    dayPassPrinterTimeoutRef.current = setTimeout(() => {
      handleDayPassPrinterSearch(query)
    }, 300)
  }, [handleDayPassPrinterSearch])

  const handlePrintDayPass = async (vehicleWithDayPass: any) => {
    const vehicleId = vehicleWithDayPass.id || vehicleWithDayPass.licensePlate
    
    // Add to printing set
    setPrintingDayPassVehicleIds(prev => new Set(prev).add(vehicleId))
    
    try {
      const staffInfo = getStaffInfo()
      const staffName = staffInfo ? `${staffInfo.firstName} ${staffInfo.lastName}` : 'Unknown'
      
      const dayPass = vehicleWithDayPass.dayPass
      
      const ticketData: TicketData = {
        licensePlate: dayPass.licensePlate || vehicleWithDayPass.licensePlate,
        destinationName: dayPass.destinationName || 'Station',
        seatNumber: 0,
        totalAmount: 0,
        basePrice: 0,
        createdBy: staffName,
        createdAt: dayPass.purchaseDate || new Date().toISOString(),
        stationName: "Station",
        routeName: dayPass.destinationName || dayPass.licensePlate,
        staffFirstName: staffInfo?.firstName || '',
        staffLastName: staffInfo?.lastName || '',
      };
      
      // Print the day pass ticket
      await printerService.printDayPassTicket(ticketData)
      
      showNotification(`✅ Pass journalier imprimé: ${vehicleWithDayPass.licensePlate}`, 'success')
      
      // Close modal after successful print
      setDayPassPrinterModalOpen(false)
      setDayPassesToPrint([])
    } catch (error) {
      console.error('Failed to print day pass:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      showNotification(`❌ Erreur impression pass journalier: ${errorMsg}`, 'error')
    } finally {
      // Remove from printing set
      setPrintingDayPassVehicleIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(vehicleId)
        return newSet
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Notification Toast */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-md ${
            notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg flex-shrink-0">{notification.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-medium break-words">{notification.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Printer Status Display */}
      <div className="flex justify-end mb-4">
        <PrinterStatusDisplay />
      </div>

      {/* Global Actions */}
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
        <button
          onClick={async () => {
            setExitPassModalOpen(true)
            setLoadingTrips(true)
            setTripsSearch('')
            try {
              const response = await listTodayTrips()
              setTrips(Array.isArray(response.data) ? response.data : [])
            } catch (error) {
              console.error('Failed to load trips:', error)
            } finally {
              setLoadingTrips(false)
            }
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-sm"
          title="Imprimer laissez-passer sortie"
        >
          🚪 Imprimer Sortie
        </button>
        <button
          onClick={() => {
            setDayPassPrinterModalOpen(true)
            setDayPassesToPrint([])
            setDayPassPrinterSearch('')
          }}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors text-sm"
          title="Imprimer pass journalier"
        >
          🎫 Imprimer Passe Jour
        </button>
      </div>

      {/* Add Vehicle - Always Visible */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-lg font-medium mb-3">Ajouter un Véhicule à la File</h3>
        
        {/* Search Input */}
        <div className="mb-3">
            <input
              type="text"
              placeholder="Rechercher par plaque d'immatriculation..."
              value={searchVehiclesQuery}
              onChange={async (e) => {
                const query = e.target.value
                setSearchVehiclesQuery(query)
                if (query.length === 0) {
                  setSearchResults([])
                  setSearching(false)
                  setSearchError(null)
                } else {
                  await handleSearchVehicles(query)
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          
          {searching && <div className="text-sm text-gray-500 mt-2">Loading...</div>}
          {searchError && <div className="text-sm text-red-600 mt-2">{searchError}</div>}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && !selectedVehicle && (
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {searchResults.map((vehicle: any) => (
              <div
                key={vehicle.id}
                onClick={() => handleSelectVehicle(vehicle)}
                className="p-3 border rounded cursor-pointer transition-colors hover:bg-gray-50"
              >
                <div className="font-medium">{vehicle.licensePlate}</div>
                <div className="text-xs text-gray-500">
                  Capacité: {vehicle.capacity} - {vehicle.isActive ? 'Actif' : 'Inactif'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Vehicle & Destination Selection */}
        {selectedVehicle && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Véhicule sélectionné :</div>
              <div className="font-semibold">{selectedVehicle.licensePlate}</div>
              <div className="text-xs text-gray-500">
                Capacité: {selectedVehicle.capacity} - {selectedVehicle.isActive ? 'Actif' : 'Inactif'}
              </div>
            </div>

            {!selectedDestination && vehicleAuthorizedStations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner une destination :
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {vehicleAuthorizedStations.map((station: any) => (
                    <div
                      key={station.stationId}
                      onClick={() => handleDestinationSelect(station.stationId, station.stationName)}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        (selectedDestination && (selectedDestination as { stationId: string }).stationId === station.stationId)
                          ? 'bg-blue-50 border-blue-500' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{station.stationName}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDestination && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Destination sélectionnée :</div>
                <div className="font-semibold">{selectedDestination.stationName}</div>
                <button
                  onClick={handleAddVehicle}
                  disabled={addingVehicle}
                  className={`mt-2 w-full px-4 py-2 rounded transition-colors ${
                    addingVehicle 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {addingVehicle ? '⏳ Ajout en cours...' : '✅ Ajouter à la File'}
                </button>
              </div>
            )}

            <button
              onClick={resetAddVehicleForm}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Choisir un autre véhicule
            </button>
          </div>
        )}
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
                      onChange={(e) => handleDayPassSearchChange(e.target.value)}
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
                        <div className="font-semibold text-green-700 mb-2">✅ Passe Jour ACTIF</div>
                        <div className="text-sm text-gray-700">
                          <p>Ce véhicule a un passe journal valide.</p>
                          {dayPassStatus.details && (
                            <>
                              <p className="mt-2 text-xs">
                                Plaque: {dayPassStatus.details.licensePlate}
                              </p>
                              <p className="text-xs">
                                Acheté le: {new Date(dayPassStatus.details.purchaseDate).toLocaleString()}
                              </p>
                              <p className="text-xs">
                                Valide jusqu'au: {new Date(dayPassStatus.details.validUntil).toLocaleString()}
                              </p>
                            </>
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

      {/* Exit Pass Printer modal */}
      {exitPassModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Imprimer Laissez-passer de Sortie</h2>
                <button
                  onClick={() => {
                    setExitPassModalOpen(false)
                    setTrips([])
                    setTripsSearch('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Search input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Rechercher par immatriculation..."
                  value={tripsSearch}
                  onChange={(e) => handleExitPassSearchChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              {/* Loading state */}
              {loadingTrips && (
                <div className="text-center py-8 text-gray-500">Chargement des trajets...</div>
              )}

              {/* Trips list */}
              {!loadingTrips && trips.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {trips.map((trip: any, index: number) => {
                    const tripId = trip.id || trip.licensePlate
                    const isPrinting = printingTripIds.has(tripId)
                    
                    return (
                      <div
                        key={trip.id || index}
                        onClick={() => !isPrinting && handlePrintExitPass(trip, index)}
                        className={`p-3 border rounded transition-colors ${
                          isPrinting 
                            ? 'bg-orange-100 border-orange-300 opacity-60 cursor-wait' 
                            : 'cursor-pointer hover:bg-orange-50 hover:border-orange-500'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {trip.licensePlate}
                              {isPrinting && <span className="text-orange-500 animate-pulse">⏳ Impression...</span>}
                            </div>
                            <div className="text-sm text-gray-600">{trip.destinationName}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{trip.seatsBooked || 0} sièges</div>
                            <div className="text-xs text-gray-500">
                              {trip.startTime ? new Date(trip.startTime).toLocaleTimeString() : 'Aujourd\'hui'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No trips found */}
              {!loadingTrips && trips.length === 0 && tripsSearch === '' && (
                <div className="text-center py-8 text-gray-500">
                  Aucun trajet trouvé pour aujourd'hui
                </div>
              )}

              {!loadingTrips && trips.length === 0 && tripsSearch !== '' && (
                <div className="text-center py-8 text-gray-500">
                  Aucun trajet trouvé pour "{tripsSearch}"
                </div>
              )}

              {/* Close button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setExitPassModalOpen(false)
                    setTrips([])
                    setTripsSearch('')
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Pass Printer modal */}
      {dayPassPrinterModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Imprimer Pass Journalier</h2>
                <button
                  onClick={() => {
                    setDayPassPrinterModalOpen(false)
                    setDayPassesToPrint([])
                    setDayPassPrinterSearch('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Search input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Rechercher par immatriculation..."
                  value={dayPassPrinterSearch}
                  onChange={(e) => handleDayPassPrinterSearchChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Loading state */}
              {loadingDayPasses && (
                <div className="text-center py-8 text-gray-500">Recherche en cours...</div>
              )}

              {/* Vehicles with day passes list */}
              {!loadingDayPasses && dayPassesToPrint.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dayPassesToPrint.map((vehicleWithDayPass: any, index: number) => {
                    const vehicleId = vehicleWithDayPass.id || vehicleWithDayPass.licensePlate
                    const isPrinting = printingDayPassVehicleIds.has(vehicleId)
                    
                    return (
                      <div
                        key={vehicleWithDayPass.id || index}
                        onClick={() => !isPrinting && handlePrintDayPass(vehicleWithDayPass)}
                        className={`p-3 border rounded transition-colors ${
                          isPrinting 
                            ? 'bg-indigo-100 border-indigo-300 opacity-60 cursor-wait' 
                            : 'cursor-pointer hover:bg-indigo-50 hover:border-indigo-500'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {vehicleWithDayPass.licensePlate}
                              {isPrinting && <span className="text-indigo-500 animate-pulse">⏳ Impression...</span>}
                            </div>
                            <div className="text-sm text-gray-600">Pass journalier actif</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              {vehicleWithDayPass.dayPass?.purchaseDate 
                                ? new Date(vehicleWithDayPass.dayPass.purchaseDate).toLocaleDateString()
                                : 'Aujourd\'hui'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No results found */}
              {!loadingDayPasses && dayPassesToPrint.length === 0 && dayPassPrinterSearch !== '' && (
                <div className="text-center py-8 text-gray-500">
                  Aucun véhicule avec pass journalier trouvé pour "{dayPassPrinterSearch}"
                </div>
              )}

              {!loadingDayPasses && dayPassesToPrint.length === 0 && dayPassPrinterSearch === '' && (
                <div className="text-center py-8 text-gray-500">
                  Recherchez un véhicule pour imprimer son pass journalier
                </div>
              )}

              {/* Close button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setDayPassPrinterModalOpen(false)
                    setDayPassesToPrint([])
                    setDayPassPrinterSearch('')
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}