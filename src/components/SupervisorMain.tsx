import React, { useEffect, useState } from 'react'
import { listStaff, createStaff, updateStaff, deleteStaff, listVehicles, createVehicle, updateVehicle, deleteVehicle, listAuthorizedStations, addAuthorizedStation, deleteAuthorizedStation } from '@/api/client'
import EnhancedStatistics from './EnhancedStatistics'
import QueueManagement from './QueueManagement'
import { Modal } from './ui/modal'

function StaffView() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    cin: '',
    phoneNumber: '',
    role: 'WORKER'
  })

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    setLoading(true)
    try {
      const response = await listStaff()
      setStaff(response.data)
    } catch (error) {
      console.error('Failed to load staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, formData)
      } else {
        await createStaff(formData)
      }
      setShowForm(false)
      setEditingStaff(null)
      setFormData({ firstName: '', lastName: '', cin: '', phoneNumber: '', role: 'WORKER' })
      loadStaff()
    } catch (error) {
      console.error('Failed to save staff:', error)
    }
  }

  const handleEdit = (staffMember: any) => {
    setEditingStaff(staffMember)
    setFormData({
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      cin: staffMember.cin,
      phoneNumber: staffMember.phoneNumber,
      role: staffMember.role
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    try {
      await deleteStaff(id)
      loadStaff()
    } catch (error) {
      console.error('Failed to delete staff:', error)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Gérer le personnel (CRUD)</p>
        <button 
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          onClick={() => setShowForm(true)}
        >
          Ajouter Personnel
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 border rounded">
          <h3 className="font-medium mb-3">{editingStaff ? 'Modifier Personnel' : 'Ajouter Personnel'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Prénom"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              className="px-2 py-1 border rounded"
              required
            />
            <input
              type="text"
              placeholder="Nom"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              className="px-2 py-1 border rounded"
              required
            />
            <input
              type="text"
              placeholder="CIN (8 chiffres)"
              value={formData.cin}
              onChange={(e) => setFormData({...formData, cin: e.target.value})}
              className="px-2 py-1 border rounded"
              maxLength={8}
              required
            />
            <input
              type="text"
              placeholder="Numéro de Téléphone"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              className="px-2 py-1 border rounded"
              required
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="px-2 py-1 border rounded"
            >
              <option value="WORKER">Employé</option>
              <option value="SUPERVISOR">Superviseur</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1 bg-green-500 text-white rounded text-sm">
                {editingStaff ? 'Mettre à jour' : 'Créer'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowForm(false)
                  setEditingStaff(null)
                  setFormData({ firstName: '', lastName: '', cin: '', phoneNumber: '', role: 'WORKER' })
                }}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-sm">Loading staff...</div>}
      {!loading && staff.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border">Name</th>
                <th className="text-left p-2 border">CIN</th>
                <th className="text-left p-2 border">Phone</th>
                <th className="text-left p-2 border">Role</th>
                <th className="text-left p-2 border">Status</th>
                <th className="text-left p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="p-2 border">{s.firstName} {s.lastName}</td>
                  <td className="p-2 border">{s.cin}</td>
                  <td className="p-2 border">{s.phoneNumber}</td>
                  <td className="p-2 border">{s.role}</td>
                  <td className="p-2 border">
                    <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-2 border">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEdit(s)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function VehiclesView() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null)
  const [authorized, setAuthorized] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  // const [authForm, setAuthForm] = useState({ stationId: '', stationName: '', priority: 1, isDefault: false })
  const [formData, setFormData] = useState({
    licensePlate: '',
    capacity: 8,
    phoneNumber: '',
    isActive: true,
    isAvailable: true,
    isBanned: false,
    selectedStations: [] as string[]
  })

  const formatLicensePlate = (value: string) => {
    // Remove all spaces and convert to uppercase
    let cleaned = value.replace(/\s/g, '').toUpperCase()
    
    // Extract numbers and TUN
    const match = cleaned.match(/^(\d{2,3})TUN(\d{1,4})$/)
    if (match) {
      const [, left, right] = match
      return `${left} TUN ${right}`
    }
    
    // If partial input, try to format it
    if (cleaned.includes('TUN')) {
      const parts = cleaned.split('TUN')
      if (parts.length === 2) {
        const left = parts[0].replace(/\D/g, '').slice(0, 3)
        const right = parts[1].replace(/\D/g, '').slice(0, 4)
        if (left.length >= 2 && right.length >= 1) {
          return `${left} TUN ${right}`
        }
      }
    }
    
    return cleaned
  }

  const validateLicensePlate = (plate: string) => {
    const cleaned = plate.replace(/\s/g, '').toUpperCase()
    return /^\d{2,3}TUN\d{1,4}$/.test(cleaned)
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    setLoading(true)
    try {
      const response = await listVehicles()
      setVehicles(response.data)
      setFilteredVehicles(response.data)
    } catch (error) {
      console.error('Failed to load vehicles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredVehicles(vehicles)
      return
    }
    const filtered = vehicles.filter(v => 
      v.licensePlate?.toLowerCase().includes(query.toLowerCase()) ||
      v.phoneNumber?.includes(query)
    )
    setFilteredVehicles(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate license plate format
    if (!validateLicensePlate(formData.licensePlate)) {
      alert('Invalid license plate format. Use format: 123 TUN 4567 (2-3 digits, TUN, 1-4 digits)')
      return
    }
    
    try {
      if (editingVehicle) {
        // Update vehicle basic info
        const vehicleData = { ...formData }
        // delete vehicleData.selectedStations
        await updateVehicle(editingVehicle.id, vehicleData)
        
        // Update authorized stations
        const currentStations = authorized.map((station: any) => station.stationId)
        const selectedStations = formData.selectedStations
        
        // Remove stations that are no longer selected
        for (const station of authorized) {
          if (!selectedStations.includes(station.stationId)) {
            await deleteAuthorizedStation(editingVehicle.id, station.id)
          }
        }
        
        // Add new stations
        for (const stationId of selectedStations) {
          if (!currentStations.includes(stationId)) {
            const stationName = stationId === 'station-jemmal' ? 'JEMMAL' :
                              stationId === 'station-ksar-hlel' ? 'KSAR HLEL' :
                              stationId === 'station-moknin' ? 'MOKNIN' :
                              stationId === 'station-teboulba' ? 'TEBOULBA' : stationId
            await addAuthorizedStation(editingVehicle.id, {
              stationId,
              stationName,
              priority: 1,
              isDefault: selectedStations.length === 1
            })
          }
        }
      } else {
        const vehicleData = { ...formData }
        // delete vehicleData.selectedStations
        const newVehicle = await createVehicle(vehicleData)
        
        // Add selected stations to the new vehicle
        if (formData.selectedStations.length > 0) {
          for (const stationId of formData.selectedStations) {
            const stationName = stationId === 'station-jemmal' ? 'JEMMAL' :
                              stationId === 'station-ksar-hlel' ? 'KSAR HLEL' :
                              stationId === 'station-moknin' ? 'MOKNIN' :
                              stationId === 'station-teboulba' ? 'TEBOULBA' : stationId
            await addAuthorizedStation(newVehicle.data.id, {
              stationId,
              stationName,
              priority: 1,
              isDefault: formData.selectedStations.length === 1
            })
          }
        }
      }
      setShowForm(false)
      setEditingVehicle(null)
      setFormData({ licensePlate: '', capacity: 8, phoneNumber: '', isActive: true, isAvailable: true, isBanned: false, selectedStations: [] })
      loadVehicles()
    } catch (error) {
      console.error('Failed to save vehicle:', error)
    }
  }

  const handleEdit = (vehicle: any) => {
    setEditingVehicle(vehicle)
    setFormData({
      licensePlate: vehicle.licensePlate,
      capacity: vehicle.capacity,
      phoneNumber: vehicle.phoneNumber || '',
      isActive: vehicle.isActive,
      isAvailable: vehicle.isAvailable,
      isBanned: vehicle.isBanned,
      selectedStations: []
    })
    // load authorized stations for this vehicle
    listAuthorizedStations(vehicle.id).then((r) => {
      setAuthorized(r.data)
      // Set selected stations based on current authorized stations
      const currentStations = r.data.map((station: any) => station.stationId)
      setFormData(prev => ({...prev, selectedStations: currentStations}))
    }).catch(() => setAuthorized([]))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle? This will also delete all related records (queue entries, day passes, etc.).')) return
    try {
      const result = await deleteVehicle(id)
      console.log('Delete result:', result)
      loadVehicles()
      alert('Vehicle deleted successfully!')
    } catch (error) {
      console.error('Failed to delete vehicle:', error)
      alert('Failed to delete vehicle. It may have related records that prevent deletion.')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Manage vehicles (CRUD)</p>
        <button 
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          onClick={() => setShowForm(true)}
        >
          Add Vehicle
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by license plate or phone number..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      {showForm && !editingVehicle && (
        <div className="mb-4 p-4 border rounded">
          <h3 className="font-medium mb-3">Add Vehicle</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="License Plate (e.g., 123 TUN 4567)"
              value={formData.licensePlate}
              onChange={(e) => {
                const formatted = formatLicensePlate(e.target.value)
                setFormData({...formData, licensePlate: formatted})
              }}
              className="px-2 py-1 border rounded"
              required
            />
            <input
              type="number"
              placeholder="Capacity"
              value={formData.capacity}
              onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
              className="px-2 py-1 border rounded"
              min="1"
              required
            />
            <input
              type="text"
              placeholder="Phone Number (optional)"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              className="px-2 py-1 border rounded"
            />
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                />
                Available
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isBanned}
                  onChange={(e) => setFormData({...formData, isBanned: e.target.checked})}
                />
                Banned
              </label>
            </div>
            
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Authorized Stations</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'station-jemmal', name: 'JEMMAL' },
                    { id: 'station-ksar-hlel', name: 'KSAR HLEL' },
                    { id: 'station-moknin', name: 'MOKNIN' },
                    { id: 'station-teboulba', name: 'TEBOULBA' }
                  ].map((station) => (
                    <label key={station.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.selectedStations.includes(station.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, selectedStations: [...formData.selectedStations, station.id]})
                          } else {
                            setFormData({...formData, selectedStations: formData.selectedStations.filter(s => s !== station.id)})
                          }
                        }}
                      />
                      {station.name}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 px-3 py-1 bg-purple-500 text-white rounded text-sm"
                  onClick={() => {
                    const allStations = ['station-jemmal', 'station-ksar-hlel', 'station-moknin', 'station-teboulba']
                    setFormData({...formData, selectedStations: allStations})
                  }}
                >
                  Select All Governorates
                </button>
              </div>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1 bg-green-500 text-white rounded text-sm">
                Create
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowForm(false)
                  setEditingVehicle(null)
                  setFormData({ licensePlate: '', capacity: 8, phoneNumber: '', isActive: true, isAvailable: true, isBanned: false, selectedStations: [] })
                }}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>

        </div>
      )}

      {loading && <div className="text-sm">Loading vehicles...</div>}
      {!loading && filteredVehicles.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-xs text-gray-500 mb-2">
            Showing {filteredVehicles.length} of {vehicles.length} vehicles
          </div>
          <table className="w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border">License Plate</th>
                <th className="text-left p-2 border">Capacity</th>
                <th className="text-left p-2 border">Phone</th>
                <th className="text-left p-2 border">Authorized Stations</th>
                <th className="text-left p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => (
                <tr key={v.id}>
                  <td className="p-2 border font-medium">{v.licensePlate}</td>
                  <td className="p-2 border">{v.capacity}</td>
                  <td className="p-2 border">{v.phoneNumber || '-'}</td>
                  <td className="p-2 border">
                    <div className="space-y-1">
                      {v.authorizedStations && v.authorizedStations.length > 0 ? (
                        (() => {
                          const stationNames = v.authorizedStations.map((s: any) => s.stationName || s.stationId).sort();
                          const allStations = ['JEMMAL', 'KSAR HLEL', 'MOKNIN', 'TEBOULBA'];
                          const hasAllStations = allStations.every(station => stationNames.includes(station));
                          
                          if (hasAllStations) {
                            return (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                                All Governorates
                              </span>
                            );
                          }
                          
                          return v.authorizedStations.map((station: any) => (
                            <div key={station.id} className="flex items-center gap-1">
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {station.stationName || station.stationId}
                              </span>
                              {station.isDefault && (
                                <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                          ));
                        })()
                      ) : (
                        <span className="text-xs text-gray-500">No stations</span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 border">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEdit(v)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(v.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filteredVehicles.length === 0 && vehicles.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          No vehicles found matching your search
        </div>
      )}
      {!loading && vehicles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No vehicles registered yet
        </div>
      )}

      {/* Edit Vehicle Modal */}
      <Modal
        isOpen={editingVehicle !== null}
        onClose={() => {
          setEditingVehicle(null)
          setFormData({ licensePlate: '', capacity: 8, phoneNumber: '', isActive: true, isAvailable: true, isBanned: false, selectedStations: [] })
        }}
        title="Edit Vehicle"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">License Plate</label>
              <input
                type="text"
                value={formData.licensePlate}
                onChange={(e) => {
                  const formatted = formatLicensePlate(e.target.value)
                  setFormData({...formData, licensePlate: formatted})
                }}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Capacity</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number (optional)</label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                  />
                  Available
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isBanned}
                    onChange={(e) => setFormData({...formData, isBanned: e.target.checked})}
                  />
                  Banned
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Authorized Stations</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'station-jemmal', name: 'JEMMAL' },
                { id: 'station-ksar-hlel', name: 'KSAR HLEL' },
                { id: 'station-moknin', name: 'MOKNIN' },
                { id: 'station-teboulba', name: 'TEBOULBA' }
              ].map((station) => (
                <label key={station.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.selectedStations.includes(station.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({...formData, selectedStations: [...formData.selectedStations, station.id]})
                      } else {
                        setFormData({...formData, selectedStations: formData.selectedStations.filter(s => s !== station.id)})
                      }
                    }}
                  />
                  {station.name}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 px-3 py-1 bg-purple-500 text-white rounded text-sm"
              onClick={() => {
                const allStations = ['station-jemmal', 'station-ksar-hlel', 'station-moknin', 'station-teboulba']
                setFormData({...formData, selectedStations: allStations})
              }}
            >
              Select All Governorates
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setEditingVehicle(null)
                setFormData({ licensePlate: '', capacity: 8, phoneNumber: '', isActive: true, isAvailable: true, isBanned: false, selectedStations: [] })
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

type Props = { onLogout: () => void };

export default function SupervisorMain({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'statistics' | 'queue' | 'staff' | 'vehicles'>('queue')
  
  // Get user role from localStorage
  const userRole = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || 'WORKER') : 'WORKER'
  const isSupervisor = userRole === 'SUPERVISOR'
  
  // Workers only see queue management, supervisors see all
  useEffect(() => {
    if (!isSupervisor) {
      setActiveTab('queue')
    }
  }, [isSupervisor])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Wasla Management</h1>
          <span className={`text-xs px-2 py-1 rounded ${
            isSupervisor ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isSupervisor ? 'Superviseur' : 'Employé'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {isSupervisor && (
            <div className="space-x-2">
              <button 
                className={`px-3 py-1 rounded ${activeTab === 'statistics' ? 'bg-blue-500 text-white' : 'border'}`} 
                onClick={() => setActiveTab('statistics')}
              >
                Statistiques
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeTab === 'queue' ? 'bg-blue-500 text-white' : 'border'}`} 
                onClick={() => setActiveTab('queue')}
              >
                Gestion Queue
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeTab === 'staff' ? 'bg-blue-500 text-white' : 'border'}`} 
                onClick={() => setActiveTab('staff')}
              >
                Personnel
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeTab === 'vehicles' ? 'bg-blue-500 text-white' : 'border'}`} 
                onClick={() => setActiveTab('vehicles')}
              >
                Véhicules
              </button>
            </div>
          )}
          {!isSupervisor && (
            <div className="text-sm text-gray-600">
              Gestion Queue
            </div>
          )}
          <button 
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            onClick={onLogout}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {activeTab === 'statistics' && isSupervisor && <EnhancedStatistics />}
      {activeTab === 'queue' && <QueueManagement />}
      {activeTab === 'staff' && isSupervisor && <StaffView />}
      {activeTab === 'vehicles' && isSupervisor && <VehiclesView />}
    </div>
  )
}



