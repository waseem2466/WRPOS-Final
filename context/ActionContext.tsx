
import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ActionType =
    | 'NAVIGATE'
    | 'BILLING_ADD'
    | 'INVENTORY_SEARCH'
    | 'CUSTOMER_SEARCH'
    | 'ANALYTICS'
    | 'INVENTORY_FILL'
    | 'UNKNOWN';

export interface Action {
    type: ActionType;
    payload?: any;
    rawInput?: string;
}

interface ActionContextType {
    lastAction: Action | null;
    dispatch: (action: Action) => void;
    clearAction: () => void;
}

const ActionContext = createContext<ActionContextType | undefined>(undefined);

export const ActionProvider = ({ children }: { children: ReactNode }) => {
    const [lastAction, setLastAction] = useState<Action | null>(null);

    const dispatch = (action: Action) => {
        console.log("Global Action Dispatched:", action);
        setLastAction(action);
    };

    const clearAction = () => {
        setLastAction(null);
    };

    return (
        <ActionContext.Provider value={{ lastAction, dispatch, clearAction }}>
            {children}
        </ActionContext.Provider>
    );
};

export const useAction = () => {
    const context = useContext(ActionContext);
    if (context === undefined) {
        throw new Error('useAction must be used within an ActionProvider');
    }
    return context;
};
