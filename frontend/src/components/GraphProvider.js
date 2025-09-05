import React, { createContext, useContext } from 'react';
import { useGraph } from '../hooks/useGraph';

const GraphContext = createContext();

export const useGraphContext = () => {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraphContext must be used within a GraphProvider');
  }
  return context;
};

export const GraphProvider = ({ children }) => {
  const graphFunctions = useGraph();
  
  return (
    <GraphContext.Provider value={graphFunctions}>
      {children}
    </GraphContext.Provider>
  );
};