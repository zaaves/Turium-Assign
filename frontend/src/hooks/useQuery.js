import { useState } from 'react';
import { submitQuery } from '../services/query.api';

export function useQuery() {
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [highlightedSourceLabel, setHighlightedSourceLabel] = useState(null);

  const askQuestion = async (question, topK = 5) => {
    if (!question || !question.trim()) {
      setQueryError('Please enter a question to ask.');
      return;
    }

    setQuerying(true);
    setQueryError(null);
    setLastQuestion(question.trim());
    setHighlightedSourceLabel(null);

    try {
      const data = await submitQuery({ question, topK });
      setQueryResult(data);
    } catch (err) {
      setQueryError(err.message || 'Failed to retrieve answer from AI Assistant.');
      setQueryResult(null);
    } finally {
      setQuerying(false);
    }
  };

  const highlightCitation = (label) => {
    setHighlightedSourceLabel(label);
    const element = document.getElementById(`source-card-${label}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const clearQuery = () => {
    setQueryResult(null);
    setQueryError(null);
    setLastQuestion('');
    setHighlightedSourceLabel(null);
  };

  return {
    querying,
    queryResult,
    queryError,
    lastQuestion,
    highlightedSourceLabel,
    askQuestion,
    highlightCitation,
    clearQuery,
  };
}
