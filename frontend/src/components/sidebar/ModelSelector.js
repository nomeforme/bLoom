import React from 'react';
import modelsConfig from '../../config/models.json';

const ModelSelector = ({
  selectedModel,
  setSelectedModel,
  availableModels,
  isGeneratingChildren,
  isGeneratingSiblings
}) => {
  return (
    <div style={{ marginBottom: '30px' }}>
      <select 
        value={selectedModel} 
        onChange={(e) => setSelectedModel(e.target.value)}
        disabled={isGeneratingChildren || isGeneratingSiblings}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #555',
          backgroundColor: '#3d3d3d',
          color: '#fff',
          fontSize: '12px',
          fontFamily: "'Inconsolata', monospace",
          marginBottom: '8px'
        }}
      >
        {availableModels.map(model => (
          <option 
            key={model.id} 
            value={model.id}
            disabled={model.available === false}
          >
            {model.name} {model.available === false ? ' - Unavailable' : ''}
          </option>
        ))}
      </select>
      {selectedModel && modelsConfig.models[selectedModel] && (
        <div style={{ fontSize: '10px', color: '#888', lineHeight: '1.3' }}>
          Model ID: {modelsConfig.models[selectedModel].modelId}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;