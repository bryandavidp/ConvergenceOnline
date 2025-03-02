// src/components/ui/AnimatedModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AnimatedModal.css';

interface AnimatedModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const AnimatedModal: React.FC<AnimatedModalProps> = ({ 
  isVisible, 
  onClose, 
  title, 
  children 
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="modal-content"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <h2>{title}</h2>
            {children}
            <button className="close-button" onClick={onClose}>
              Cerrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedModal;
