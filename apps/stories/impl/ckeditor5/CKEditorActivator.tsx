import * as React from "react";
import {CKEditor5BalloonEditor} from "./CKEditor5BalloonEditor";
import {HTMLStr} from "polar-shared/src/util/Strings";
import {NULL_FUNCTION} from "polar-shared/src/util/Functions";
import { Numbers } from "polar-shared/src/util/Numbers";
import {arrayStream} from "polar-shared/src/util/ArrayStreams";

interface ActiveProps {
    readonly content: HTMLStr;
    readonly offset: EditorCursorPosition;
    readonly onEditor: (editor: ckeditor5.IEditor) => void;
}

export type EditorCursorPosition = number | 'before' | 'end';

/**
 * An editor activator does the following:
 *
 * - if the editor is not mounted, we mount it and load the editor
 * - if an offset is specified and jump to that offset
 * - focus the editor
 */
export type EditorActivator = (offset?: EditorCursorPosition) => void;

function editorActivator(editor: ckeditor5.IEditor, offset?: EditorCursorPosition) {

    const doc = editor.model.document;

    editor.model.change((writer) => {

        const root = doc.getRoot();

        if (offset !== undefined) {

            switch (offset) {

                case 'before':
                case 'end':
                    writer.setSelection(root, offset)
                    break;

                default:
                    const position = writer.createPositionFromPath(root, [0, offset]);
                    const range = writer.createRange(position, position);

                    writer.setSelection(range);
                    break;
            }

        }

    });

    editor.editing.view.focus();

}

const Active = (props: ActiveProps) => {

    const handleEditor = React.useCallback((editor: ckeditor5.IEditor) => {
        editorActivator(editor, props.offset);

        props.onEditor(editor);

    }, [props]);

    return (

        <CKEditor5BalloonEditor content={props.content}
                                onChange={NULL_FUNCTION}
                                onEditor={handleEditor}/>

    );

}

interface InactiveProps {

    readonly content: HTMLStr;

    /**
     * Called when we've been activated by clicking.
     */
    readonly onActivated: (offset: number) => void;

}


interface INodeTextBoundingClientRect {

    readonly text: Text;
    readonly start: number;
    readonly end: number;

    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;

}

namespace NodeTextBoundingClientRects {

    // https://javascript.info/selection-range
    // https://stackoverflow.com/questions/1461059/is-there-an-equivalent-to-getboundingclientrect-for-text-nodes
    export function compute(element: HTMLElement): ReadonlyArray<INodeTextBoundingClientRect> {

        const childNodes = Array.from(element.childNodes);

        const result: INodeTextBoundingClientRect[] = [];

        for (const childNode of childNodes) {

            switch (childNode.nodeType) {
                case Node.ELEMENT_NODE:
                    result.push(...compute(childNode as HTMLElement));
                    break;
                case Node.TEXT_NODE:
                    result.push(...computeForTextNode(childNode as Text));
                    break;
            }

        }

        return result;

    }

    function computeNodeTextBoundingClientRect(text: Text,
                                               start: number,
                                               end: number): INodeTextBoundingClientRect {

        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, end);

        const bcr = range.getBoundingClientRect();

        return {
            text, start, end,
            left: bcr.left,
            top: bcr.top,
            width: bcr.width,
            height: bcr.height
        };

    }

    function computeForTextNode(text: Text) {

        return Numbers.range(0, text.length - 1)
                      .map(start => computeNodeTextBoundingClientRect(text, start, start + 1));

    }

    export function computeNearest(nodes: ReadonlyArray<INodeTextBoundingClientRect>,
                                   left: number,
                                   top: number): INodeTextBoundingClientRect | undefined {

        interface IDistance {
            readonly node: INodeTextBoundingClientRect,
            readonly distance: number;
        }

        function computeDistance(node: INodeTextBoundingClientRect): IDistance {
            const distance = Math.abs(left - node.left) + Math.abs(top - node.top);
            return {distance, node};
        }

        return arrayStream(nodes)
                   .map(computeDistance)
                   .sort((a, b) => a.distance - b.distance)
                   .first()?.node;

    }

}

const Inactive = (props: InactiveProps) => {

    const elementRef = React.useRef<HTMLDivElement |  null>(null);

    const handleClick = React.useCallback((event: React.MouseEvent) => {

        if (elementRef.current === null) {
            console.warn("No element yet");
            return;
        }

        function computeOffset(): number {

            if (elementRef.current === null) {
                return 0;
            }

            const nodes = NodeTextBoundingClientRects.compute(elementRef.current);
            const clickedNode = NodeTextBoundingClientRects.computeNearest(nodes, event.clientX, event.clientY);

            if (clickedNode) {
                const range = document.createRange();
                range.setStart(elementRef.current, 0);
                range.setEnd(clickedNode.text, clickedNode.end);
                return range.cloneContents().textContent?.length || 0;
            }

            return 0;

        }

        const offset = computeOffset();

        props.onActivated(offset);

    }, [props]);

    return (
        <div ref={elementRef}
             onClick={handleClick}
             dangerouslySetInnerHTML={{__html: props.content}}>

        </div>
    );
}

interface IProps {

    /**
     * Callback to provide an 'activator' that allows the caller to activate the
     * given component.
     *
     */
    readonly onActivator: (activator: EditorActivator) => void;
    readonly onActivated: (editor: ckeditor5.IEditor) => void;

    readonly content: HTMLStr;

}

export const CKEditorActivator = (props: IProps) => {

    const [active, setActive] = React.useState(false);
    const offsetRef = React.useRef<EditorCursorPosition>(0);
    const editorRef = React.useRef<ckeditor5.IEditor | undefined>(undefined);

    const handleActivated = React.useCallback((offset?: EditorCursorPosition) => {

        if (active) {

            if (editorRef.current) {
                editorActivator(editorRef.current, offset);
            } else {
                console.warn("No editor");
            }

        } else {

            // this will trigger the initial mount with the right offset.

            if (offset !== undefined) {
                offsetRef.current = offset;
            }

            setActive(true);

        }

    }, [active]);

    const activator = React.useCallback((offset?: EditorCursorPosition) => {
        handleActivated(offset);
    }, [handleActivated]);

    const handleEditor = React.useCallback((editor: ckeditor5.IEditor) => {

        editorRef.current = editor;
        props.onActivated(editor);

    }, [props]);

    React.useEffect(() => {
        props.onActivator(activator)
    }, [activator, props]);

    if (active) {

        return (
            <Active offset={offsetRef.current}
                    content={props.content}
                    onEditor={handleEditor}/>
        );

    } else {

        return (
            <Inactive onActivated={activator}
                      content={props.content}/>
        );

    }

}
