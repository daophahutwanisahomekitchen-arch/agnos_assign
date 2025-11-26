'use client';

import { useState, useRef, useEffect, useMemo, Children, isValidElement, ChangeEvent } from 'react';
import { socket } from '@/lib/socket';
import { format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';

// Lightweight session id generator (no external deps)
function generateSessionId() {
  return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

interface DropdownOption {
  value: string | number;
  label: React.ReactNode;
}

interface CustomDayPickerDropdownProps {
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children?: React.ReactNode;
  options?: DropdownOption[];
  style?: React.CSSProperties;
  className?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  [key: string]: unknown;
}

const INITIAL_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  dob: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  language: '',
  nationality: '',
  religion: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
};

const inputClasses = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-300 placeholder-transparent peer";
const labelClasses = "absolute left-4 -top-2.5 text-xs font-medium text-primary bg-white px-1 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-primary";
const groupClasses = "relative transition-all duration-300";
const cardClasses = "glass-panel p-8 rounded-3xl transition-all duration-300 hover:shadow-lg hover:border-primary/30";

function CustomDayPickerDropdown(props: CustomDayPickerDropdownProps) {
  const { value, onChange, children } = props;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen]);

  let options: DropdownOption[] = [];

  if (props.options) {
    options = props.options;
  } else if (children) {
    options = Children.map(children, (child) => {
      if (isValidElement(child)) {
        const childElement = child as React.ReactElement<{ value: string | number; children: React.ReactNode }>;
        return {
          value: childElement.props.value,
          label: childElement.props.children
        };
      }
      return null;
    })?.filter((opt): opt is DropdownOption => opt !== null) || [];
  }

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  return (
    <div className="relative inline-block mx-1" ref={containerRef}>
      <div 
        className={`h-8 px-3 rounded-lg border bg-white flex items-center gap-2 cursor-pointer transition-all duration-200 ${isOpen ? 'border-primary ring-2 ring-primary/10' : 'border-gray-200 hover:border-primary/50'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-medium text-gray-700">{selectedOption?.label || value}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="absolute z-100 mt-1 min-w-[120px] max-h-[200px] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 custom-scrollbar animate-in fade-in zoom-in-95 left-1/2 -translate-x-1/2">
          {options.length > 0 ? options.map((option) => (
            <div
              key={option.value}
              data-selected={String(option.value) === String(value)}
              className={`px-4 py-2 text-sm cursor-pointer transition-colors whitespace-nowrap ${String(option.value) === String(value) ? 'bg-primary/10 text-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => {
                if (onChange) {
                  onChange({ target: { value: option.value } } as ChangeEvent<HTMLSelectElement>);
                }
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          )) : (
            <div className="px-4 py-2 text-sm text-gray-400">No options</div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomDatePicker({ value, onChange, error }: { value: string, onChange: (date: string) => void, error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedDate = value ? parseISO(value) : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="relative group/date cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`w-full pl-4 pr-4 py-3 rounded-xl border bg-white/70 outline-none transition-all duration-300 flex items-center h-[50px] ${error ? 'border-red-500 ring-4 ring-red-500/10' : isOpen ? 'border-primary ring-4 ring-primary/10' : 'border-gray-200'}`}>
          <span className={`${value ? 'text-gray-900' : 'text-transparent'} transition-colors`}>
            {value ? format(parseISO(value), 'PPP') : 'Select Date'}
          </span>
        </div>
        <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${value || isOpen ? '-top-2.5 text-xs font-medium text-primary bg-white px-1' : 'top-3.5 text-base text-gray-400'}`}>
          Date of Birth
        </label>
      </div>
      {error && <p className="text-red-500 text-xs mt-1 ml-1 font-medium animate-in slide-in-from-top-1 error-message">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white/90 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200 left-0 sm:left-auto">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            disabled={{ after: new Date() }}
            captionLayout="dropdown"
            fromYear={1920}
            toYear={new Date().getFullYear()}
            showOutsideDays
            className="border-0"
            components={{
              Dropdown: CustomDayPickerDropdown
            }}
            classNames={{
              caption: "flex justify-center py-2 mb-4 relative items-center",
              caption_label: "text-sm font-bold text-gray-900",
              nav: "flex items-center",
              nav_button: "h-7 w-7 bg-transparent hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors text-gray-600",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/5 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md transition-colors",
              day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
              day_today: "bg-gray-100 text-gray-900 font-bold",
              day_outside: "text-gray-300 opacity-50",
              day_disabled: "text-gray-300 opacity-50",
              day_hidden: "invisible",
              caption_dropdowns: "flex gap-2",
            }}
          />
        </div>
      )}
    </div>
  );
}

function CustomSelect({ 
  label, 
  value, 
  onChange, 
  options,
  error
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void; 
  options: string[]; 
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className={`w-full px-4 py-3 rounded-xl border bg-white/70 outline-none transition-all duration-300 flex items-center justify-between cursor-pointer ${error ? 'border-red-500 ring-4 ring-red-500/10' : isOpen ? 'border-primary ring-4 ring-primary/10' : 'border-gray-200'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${value ? 'text-gray-900' : 'text-transparent'} transition-colors`}>
          {value || 'Select'}
        </span>
        <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      
      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${value || isOpen ? '-top-2.5 text-xs font-medium text-primary bg-white px-1' : 'top-3.5 text-base text-gray-400'}`}>
        {label}
      </label>
      {error && <p className="text-red-500 text-xs mt-1 ml-1 font-medium animate-in slide-in-from-top-1 error-message">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 max-h-60 overflow-auto bg-white/90 backdrop-blur-xl border border-gray-100 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
          {options.map((option) => (
            <div
              key={option}
              className={`px-4 py-3 cursor-pointer transition-colors text-sm ${value === option ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressAutocomplete({ value, onChange, error }: { value: string, onChange: (value: string) => void, error?: string }) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAddress = async (query: string) => {
    if (!query || query.length < 3) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'User-Agent': 'AgnosHealthApp/1.0'
        }
      });
      const data = await res.json();
      setSuggestions(data);
      setIsOpen(true);
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value && document.activeElement === containerRef.current?.querySelector('input')) {
         fetchAddress(value);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative" ref={containerRef}>
       <input
          required
          name="address"
          id="address"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          className={`${inputClasses} ${error ? 'border-red-500! focus:border-red-500! ring-red-500/10!' : ''}`}
          placeholder=" "
          autoComplete="off"
       />
       <label htmlFor="address" className={labelClasses}>
          Home Address
       </label>
       {error && <p className="text-red-500 text-xs mt-1 ml-1 font-medium animate-in slide-in-from-top-1 error-message">{error}</p>}
       
       {isLoading && (
         <div className="absolute right-4 top-3.5">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
         </div>
       )}

       {isOpen && suggestions.length > 0 && (
         <div className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            {suggestions.map((item, index) => (
              <div
                key={index}
                className="px-4 py-3 text-sm text-gray-600 hover:bg-primary/5 hover:text-primary cursor-pointer border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3"
                onClick={() => {
                  onChange(item.display_name);
                  setIsOpen(false);
                  setSuggestions([]);
                }}
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{item.display_name}</span>
              </div>
            ))}
            {/* <div className="px-2 py-1 bg-gray-50 text-[10px] text-gray-400 text-right">
              Powered by OpenStreetMap
            </div> */}
         </div>
       )}
    </div>
  );
}

export default function PatientForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);

  // A stable session id per client/device (used to isolate drafts)
  const sessionIdRef = useRef<string>(generateSessionId());
  useEffect(() => {
    // announce our patient session when this component mounts
    try {
      socket.emit('patient-session', { sessionId: sessionIdRef.current });
    } catch (err) {
      console.warn('Failed to emit patient-session', err);
    }
    return () => {
      try {
        socket.emit('leave-session', { sessionId: sessionIdRef.current });
      } catch {
        /* ignore */
      }
    };
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const getInputClass = (fieldName: string) => {
    return `${inputClasses} ${errors[fieldName] ? '!border-red-500 focus:!border-red-500 !ring-red-500/10' : ''}`;
  };

  const renderError = (fieldName: string) => {
    return errors[fieldName] && (
      <p className="text-red-500 text-xs mt-1 ml-1 font-medium animate-in slide-in-from-top-1 error-message">
        {errors[fieldName]}
      </p>
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Step 1: Personal Information
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.dob) newErrors.dob = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';

    // Step 2: Contact Details
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.address.trim()) newErrors.address = 'Address is required';

    // Step 3: Additional Info
    if (!formData.language) newErrors.language = 'Preferred language is required';
    if (!formData.nationality) newErrors.nationality = 'Nationality is required';

    // Step 4: Emergency Contact (Optional)
    if (formData.emergencyContactPhone.trim() && !/^\+?[\d\s-]{10,}$/.test(formData.emergencyContactPhone)) {
      newErrors.emergencyContactPhone = 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    socket.emit('input-change', { sessionId: sessionIdRef.current, data: newData });
  };

  const currentStep = useMemo(() => {
    const { firstName, lastName, dob, gender } = formData;
    if (!firstName || !lastName || !dob || !gender) return 1;
    
    const { phone, email, address } = formData;
    if (!phone || !email || !address) return 2;

    const { language, nationality } = formData;
    if (!language || !nationality) return 3;
    
    return 4;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const oldSession = sessionIdRef.current;
      socket.emit('form-submit', { sessionId: oldSession, data: formData });
      // Show success UI and clear form
      setShowSuccess(true);
      setFormData(INITIAL_FORM);
      setErrors({});
      // leave previous session and start a fresh one for the next registration
      try {
        socket.emit('leave-session', { sessionId: oldSession });
      } catch {
        /* ignore */
      }
      sessionIdRef.current = generateSessionId();
      try { socket.emit('patient-session', { sessionId: sessionIdRef.current }); } catch { }
      // hide after a short delay
      setTimeout(() => setShowSuccess(false), 3200);
    } else {
      const firstError = document.querySelector('.error-message');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
      
      {/* Progress / Header */}
      <div className="sticky top-6 z-40 mb-10">
        <div className="glass-panel rounded-2xl p-2 flex items-center justify-between shadow-2xl shadow-primary/10 border border-white/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 pl-2">
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl bg-linear-to-br flex items-center justify-center text-white font-bold shadow-lg transition-all duration-500 ${
                currentStep === 1 ? 'from-primary to-accent shadow-primary/30' :
                currentStep === 2 ? 'from-blue-500 to-indigo-500 shadow-blue-500/30' :
                currentStep === 3 ? 'from-purple-500 to-pink-500 shadow-purple-500/30' :
                'from-green-500 to-emerald-500 shadow-green-500/30'
              }`}>
                {currentStep === 1 && (
                  <svg className="w-6 h-6 animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}
                {currentStep === 2 && (
                  <svg className="w-6 h-6 animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                )}
                {currentStep === 3 && (
                  <svg className="w-6 h-6 animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                )}
                {currentStep === 4 && (
                  <svg className="w-6 h-6 animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">Patient Registration</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                <span className={`px-2 py-0.5 rounded-full transition-colors duration-300 ${
                  currentStep === 1 ? 'bg-primary/10 text-primary' :
                  currentStep === 2 ? 'bg-blue-100 text-blue-600' :
                  currentStep === 3 ? 'bg-purple-100 text-purple-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  Step {currentStep} of 4
                </span>
                <span>•</span>
                <span className="transition-all duration-300">
                  {currentStep === 1 ? 'Personal Details' : 
                   currentStep === 2 ? 'Contact Info' : 
                   currentStep === 3 ? 'Additional Info' : 
                   'Emergency Contact'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center pr-4">
            <div className="text-right mr-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Status</div>
              <div className="text-sm font-medium text-green-600 flex items-center justify-end gap-1">
                Online <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
              </div>
            </div>
            <div className="h-10 w-px bg-gray-200 mx-2"></div>
            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Personal Info */}
        <div className="lg:col-span-2 space-y-8">
          <section className={`${cardClasses} relative z-30`}>
            <h3 className="text-xl font-bold text-primary-dark mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={groupClasses}>
                <input required name="firstName" id="firstName" value={formData.firstName} onChange={handleChange} className={getInputClass('firstName')} placeholder=" " />
                <label htmlFor="firstName" className={labelClasses}>First Name</label>
                {renderError('firstName')}
              </div>
              
              <div className={groupClasses}>
                <input name="middleName" id="middleName" value={formData.middleName} onChange={handleChange} className={inputClasses} placeholder=" " />
                <label htmlFor="middleName" className={labelClasses}>Middle Name</label>
              </div>

              <div className={`${groupClasses} md:col-span-2`}>
                <input required name="lastName" id="lastName" value={formData.lastName} onChange={handleChange} className={getInputClass('lastName')} placeholder=" " />
                <label htmlFor="lastName" className={labelClasses}>Last Name</label>
                {renderError('lastName')}
              </div>

              <div className={groupClasses}>
                <CustomDatePicker 
                  value={formData.dob} 
                  onChange={(date) => handleChange({ target: { name: 'dob', value: date } } as ChangeEvent<HTMLInputElement>)} 
                  error={errors.dob}
                />
              </div>

              <div className="relative">
                <label className="text-xs font-bold text-primary-dark ml-1 mb-2 block uppercase tracking-wider">Gender Identity</label>
                <div className={`grid grid-cols-3 gap-3 ${errors.gender ? 'p-1 border border-red-500 rounded-2xl bg-red-50/50' : ''}`}>
                  {[
                    { value: 'male', label: 'Male', icon: '👨' },
                    { value: 'female', label: 'Female', icon: '👩' },
                    { value: 'other', label: 'Other', icon: '🌈' }
                  ].map((option) => (
                    <div
                      key={option.value}
                      onClick={() => handleChange({ target: { name: 'gender', value: option.value } } as ChangeEvent<HTMLInputElement>)}
                      className={`
                        relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-center gap-2 transition-all duration-300 border-2 group
                        ${formData.gender === option.value 
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20 scale-105' 
                          : 'border-transparent bg-white/60 hover:bg-white hover:border-primary/30 hover:shadow-md hover:-translate-y-1'
                        }
                      `}
                    >
                      <div className={`text-2xl transition-all duration-300 ${formData.gender === option.value ? 'scale-110 rotate-6' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                        {option.icon}
                      </div>
                      <span className={`text-xs font-bold ${formData.gender === option.value ? 'text-primary' : 'text-gray-500'}`}>
                        {option.label}
                      </span>
                    </div>
                  ))}
                </div>
                {renderError('gender')}
                <input 
                  type="text" 
                  name="gender" 
                  aria-label="Gender"
                  value={formData.gender} 
                  required 
                  className="sr-only" 
                  onChange={() => {}}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please select a gender')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
            </div>
          </section>

          <section className={`${cardClasses} relative z-20`}>
            <h3 className="text-xl font-bold text-primary-dark mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Contact Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={groupClasses}>
                <input required type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className={getInputClass('phone')} placeholder=" " />
                <label htmlFor="phone" className={labelClasses}>Phone Number</label>
                {renderError('phone')}
              </div>

              <div className={groupClasses}>
                <input required type="email" name="email" id="email" value={formData.email} onChange={handleChange} className={getInputClass('email')} placeholder=" " />
                <label htmlFor="email" className={labelClasses}>Email Address</label>
                {renderError('email')}
              </div>

              <div className={`${groupClasses} md:col-span-2`}>
                <AddressAutocomplete 
                  value={formData.address}
                  onChange={(value) => handleChange({ target: { name: 'address', value } } as ChangeEvent<HTMLInputElement>)}
                  error={errors.address}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-8">
          <section className={`${cardClasses} h-fit relative z-20`}>
            <h3 className="text-xl font-bold text-primary-dark mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Additional Info
            </h3>
            
            <div className="space-y-6">
              <div className={`${groupClasses} z-30`}>
                <CustomSelect
                  label="Preferred Language"
                  value={formData.language}
                  onChange={(value) => handleChange({ target: { name: 'language', value } } as ChangeEvent<HTMLInputElement>)}
                  options={[ "Thai", "English", "Spanish", "French", "German", "Chinese", "Japanese", "Arabic", "Hindi", "Portuguese", "Russian","Other"]}
                  error={errors.language}
                />
              </div>

              <div className={`${groupClasses} z-20`}>
                <CustomSelect
                  label="Nationality"
                  value={formData.nationality}
                  onChange={(value) => handleChange({ target: { name: 'nationality', value } } as ChangeEvent<HTMLInputElement>)}
                  options={[ "Thai", "American", "British", "Canadian", "Australian", "Chinese", "Indian", "Japanese", "French", "German", "Brazilian", "Other"]}
                  error={errors.nationality}
                />
              </div>

              <div className={groupClasses}>
                <input name="religion" id="religion" value={formData.religion} onChange={handleChange} className={inputClasses} placeholder=" " />
                <label htmlFor="religion" className={labelClasses}>Religion (Optional)</label>
              </div>
            </div>
          </section>

          <section className={`${cardClasses} h-fit border-l-4 border-l-accent relative z-10`}>
            <h3 className="text-xl font-bold text-primary-dark mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Emergency Contact
            </h3>
            
            <div className="space-y-6">
              <div className={groupClasses}>
                <input name="emergencyContactName" id="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className={getInputClass('emergencyContactName')} placeholder=" " />
                <label htmlFor="emergencyContactName" className={labelClasses}>Contact Name</label>
                {renderError('emergencyContactName')}
              </div>

              <div className={groupClasses}>
                <input name="emergencyContactRelation" id="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} className={getInputClass('emergencyContactRelation')} placeholder=" " />
                <label htmlFor="emergencyContactRelation" className={labelClasses}>Relationship</label>
                {renderError('emergencyContactRelation')}
              </div>

              <div className={groupClasses}>
                <input type="tel" name="emergencyContactPhone" id="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className={getInputClass('emergencyContactPhone')} placeholder=" " />
                <label htmlFor="emergencyContactPhone" className={labelClasses}>Emergency Phone</label>
                {renderError('emergencyContactPhone')}
              </div>
            </div>
          </section>

          <button type="submit" className="w-full bg-linear-to-r from-primary to-accent text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transform transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 group">
            <span className="flex items-center justify-center gap-2">
              Submit Registration
              <svg className="w-5 h-5 transform transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </span>
          </button>
          {showSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in"></div>
              <div role="dialog" aria-modal="true" aria-labelledby="success-title" className="relative bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-md mx-4 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 id="success-title" className="text-lg font-bold text-gray-900">Registration submitted</h3>
                <p className="text-sm text-gray-600 text-center">Thanks — we have received your registration and notified the staff dashboard.</p>
                <button onClick={() => setShowSuccess(false)} className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-green-700">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
