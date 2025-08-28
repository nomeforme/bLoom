import { useState, useEffect } from 'react';
import { isIPFSReference, resolveNodeContent } from '../utils/ipfsUtils';

// React hook for resolving IPFS content
export const useIPFSContent = (content) => {
  const [resolvedContent, setResolvedContent] = useState(content);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!content || !isIPFSReference(content)) {
      setResolvedContent(content);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    resolveNodeContent(content)
      .then((resolved) => {
        setResolvedContent(resolved);
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setResolvedContent(`[IPFS Error: ${err.message}]`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [content]);

  return {
    content: resolvedContent,
    isLoading,
    error,
    isIPFS: isIPFSReference(content)
  };
};

// Batch hook for resolving multiple IPFS contents
export const useBatchIPFSContent = (contents = []) => {
  const [resolved, setResolved] = useState(new Map());
  const [loading, setLoading] = useState(new Set());
  const [errors, setErrors] = useState(new Map());

  useEffect(() => {
    if (!contents.length) return;

    const ipfsContents = contents.filter(({ content }) => isIPFSReference(content));
    
    if (!ipfsContents.length) {
      // No IPFS content to resolve
      const resolvedMap = new Map();
      contents.forEach(({ id, content }) => {
        resolvedMap.set(id, content);
      });
      setResolved(resolvedMap);
      setLoading(new Set());
      setErrors(new Map());
      return;
    }

    // Set loading state for IPFS contents
    setLoading(new Set(ipfsContents.map(({ id }) => id)));

    // Resolve each IPFS content
    const resolvePromises = ipfsContents.map(async ({ id, content }) => {
      try {
        const resolvedContent = await resolveNodeContent(content);
        return { id, content: resolvedContent, error: null };
      } catch (error) {
        return { id, content: `[IPFS Error: ${error.message}]`, error };
      }
    });

    Promise.allSettled(resolvePromises).then((results) => {
      const newResolved = new Map(resolved);
      const newErrors = new Map();
      const newLoading = new Set();

      // Add non-IPFS contents
      contents.forEach(({ id, content }) => {
        if (!isIPFSReference(content)) {
          newResolved.set(id, content);
        }
      });

      // Process resolved IPFS contents
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { id, content, error } = result.value;
          newResolved.set(id, content);
          if (error) {
            newErrors.set(id, error);
          }
        } else {
          const { id } = ipfsContents[index];
          newResolved.set(id, `[IPFS Resolution Failed]`);
          newErrors.set(id, result.reason);
        }
      });

      setResolved(newResolved);
      setErrors(newErrors);
      setLoading(newLoading);
    });
  }, [contents, resolved]);

  return {
    resolved,
    loading,
    errors,
    getContent: (id) => resolved.get(id),
    isLoading: (id) => loading.has(id),
    getError: (id) => errors.get(id)
  };
};