import React from 'react';
import {
    CommandActionMenuItemProvider,
    ICommandActionMenuPosition,
    useCommandActionMenuStore
} from "./CommandActionMenuStore";
import {ContentEditables} from "../../notes/ContentEditables";
import {NoteActionSelections} from "../../notes/NoteActionSelections";

export type ReactKeyboardEventHandler = (event: React.KeyboardEvent, contenteditable: HTMLElement | null) => void;

export type NoteActionReset = () => void;

export type NoteActionsResultTuple = [ReactKeyboardEventHandler, NoteActionReset];

interface IOpts {

    /**
     * The trigger characters that have to fire to bring up the dialog.
     */
    readonly trigger: string;


    // /**
    //  * The provider for the commands which we filter for when computing the
    //  * prompt and then set in the store.
    //  */
    // readonly itemsProvider: CommandActionMenuItemProvider;

}

interface ICursorRange {
    readonly node: Node;
    readonly offset: number;
}

export function useCommandActionMenu(opts: IOpts): NoteActionsResultTuple {

    const {trigger} = opts;

    const store = useCommandActionMenuStore();

    const activeRef = React.useRef(false);

    const textAtTriggerPointRef = React.useRef("");

    const reset = React.useCallback(() => {

        console.log("FIXME reset");
        activeRef.current = false;
        store.setState(undefined);
    }, [store])

    const eventHandler = React.useCallback((event, contenteditable) => {

        if (! contenteditable) {
            console.log("FIXME1");
            return;
        }

        const split = ContentEditables.splitAtCursor(contenteditable)

        if (! split) {
            console.log("FIXME2");
            return;
        }

        const prefixText = ContentEditables.fragmentToText(split.prefix);

        function computePrompt() {
            return prefixText.substr(textAtTriggerPointRef.current.length);
        }

        if (activeRef.current) {

            const prompt = computePrompt();

            if (event.key === 'Escape') {
                reset();
                return;
            }

            console.log(`FIXME: prompt: '${prompt}'`);

            if (prompt === '') {
                reset();
                return;
            }

        } else {

            if (prefixText.endsWith(trigger)) {

                console.log("FIXME: triggered with store: " + store.id);

                textAtTriggerPointRef.current = prefixText;

                const prompt = computePrompt();

                function computePosition() {

                    const cursorRange = NoteActionSelections.computeCursorRange();

                    if (cursorRange) {

                        const bcr = cursorRange.getBoundingClientRect();

                        const newPosition = {
                            top: bcr.bottom,
                            left: bcr.left,
                        };

                        if (newPosition.top !== 0 && newPosition.left !== 0) {
                            return newPosition;
                        }
                    }

                    return undefined;

                }

                const position = computePosition();

                if (position) {

                    console.log("FIXME: setting state")

                    activeRef.current = true;

                    store.setState({
                        position,
                        items: []
                    });

                } else {
                    console.log("FIXME no position")
                }

                // triggerPointRef.current = computeCursorRange();
                // const cursorRange = NoteActionSelections.computeCursorRange();
                //
                // if (cursorRange) {
                //
                //     const bcr = cursorRange.getBoundingClientRect();
                //
                //     const newPosition = {
                //         top: bcr.bottom,
                //         left: bcr.left,
                //     };
                //
                //     if (newPosition.top !== 0 && newPosition.left !== 0) {
                //         setMenuPosition(newPosition);
                //     }
                //
                // }

            }

    }



    }, [reset, store, trigger]);

    return [eventHandler, reset];

}

function computeCursorRange(): ICursorRange {

    const sel = window.getSelection();

    if (sel) {

        if (sel.rangeCount > 0) {

            const range = sel.getRangeAt(0);

            return {
                node: range.startContainer,
                offset: range.startOffset
            }

        }

    }

    throw new Error("No range point");

}
