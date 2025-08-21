// frontend/src/components/common/Tabs.tsx
import React, { useContext } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

type TabsListProps = {
  children: React.ReactNode;
  className?: string;
};

type TabsTriggerProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

type TabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

// Create context with proper TypeScript type
const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export const Tabs: React.FC<TabsProps> = ({ 
  value, 
  onValueChange, 
  children, 
  className = '' 
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={`w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<TabsListProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`flex border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value, 
  children, 
  className = '' 
}) => {
  const tabsContext = useContext(TabsContext);
  
  if (!tabsContext) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }

  const { value: activeValue, onValueChange } = tabsContext;
  const isActive = activeValue === value;
  
  return (
    <button
      className={`
        px-4 py-2 text-sm font-medium transition-colors
        ${isActive 
          ? 'text-primary border-b-2 border-primary' 
          : 'text-gray-500 hover:text-gray-700'
        }
        ${className}
      `}
      onClick={() => onValueChange(value)}
    >
      <div className="flex items-center">
        {children}
      </div>
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({ 
  value, 
  children, 
  className = '' 
}) => {
  const tabsContext = useContext(TabsContext);
  
  if (!tabsContext) {
    throw new Error('TabsContent must be used within a Tabs component');
  }

  const { value: activeValue } = tabsContext;
  const isActive = activeValue === value;
  
  if (!isActive) return null;
  
  return (
    <div className={className}>
      {children}
    </div>
  );
};