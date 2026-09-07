import React, { useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import ReportModal from './src/components/common/ReportModal';
import { AuthProvider } from './src/context/AuthContext';
import { BrowserRouter } from 'react-router';

// Create a wrapper to simulate the parent page
const TestWrapper = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReportModal 
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          type="product"
          targetId="123"
        />
      </AuthProvider>
    </BrowserRouter>
  );
};

// Mount the component
const { container, unmount } = render(<TestWrapper />);

// Find the textarea
const textarea = document.querySelector('textarea');
if (!textarea) {
  console.log('Textarea not found!');
  process.exit(1);
}

console.log('Initial value:', textarea.value);

// Simulate typing
fireEvent.change(textarea, { target: { value: 'test' } });

// Check value
console.log('Value after typing "test":', textarea.value);

// Check if textarea was recreated (unmounted/remounted)
const textareaAfterType = document.querySelector('textarea');
console.log('Is same textarea element?', textarea === textareaAfterType);

console.log('Test completed successfully');
