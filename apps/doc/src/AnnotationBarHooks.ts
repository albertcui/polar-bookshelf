import * as React from "react";
import {IDocViewerStore, useDocViewerStore} from "./DocViewerStore";
import {SimpleReactor} from "../../../web/js/reactor/SimpleReactor";
import {PopupStateEvent} from "../../../web/js/ui/popup/PopupStateEvent";
import {TriggerPopupEvent} from "../../../web/js/ui/popup/TriggerPopupEvent";
import {ControlledPopupProps} from "../../../web/js/ui/popup/ControlledPopup";
import {
    AnnotationBarCallbacks,
    OnHighlightedCallback
} from "../../../web/js/ui/annotationbar/ControlledAnnotationBar";
import {HighlightCreatedEvent} from "../../../web/js/comments/react/HighlightCreatedEvent";
import {ControlledAnnotationBars} from "../../../web/js/ui/annotationbar/ControlledAnnotationBars";
import {
    ITextHighlightCreate,
    useAnnotationMutationsContext
} from "../../../web/js/annotation_sidebar/AnnotationMutationsContext";
import {TextHighlighter} from "./text_highlighter/TextHighlighter";
import {useDocViewerFileTypeContext} from "./renderers/DocRenderer";
import {SelectedContents} from "../../../web/js/highlights/text/selection/SelectedContents";
import {ISelectedContent} from "../../../web/js/highlights/text/selection/ISelectedContent";
import {HighlightColor} from "polar-shared/src/metadata/IBaseHighlight";


/**
 * The minimum properties we need to annotate without having to have the full
 * store context like docMeta.
 */
interface ICreateTextHighlightCallbackOpts {

    readonly pageNum: number;

    readonly highlightColor: HighlightColor;

    readonly selectedContent: ISelectedContent;

}

type CreateTextHighlightCallback = (opts: ICreateTextHighlightCallbackOpts) => void;

function useCreateTextHighlightCallback(): CreateTextHighlightCallback {

    const annotationMutations = useAnnotationMutationsContext();
    const {docMeta, docScale} = useDocViewerStore(['docMeta', 'docScale']);

    return (opts: ICreateTextHighlightCallbackOpts) => {

        if (! docMeta) {
            throw new Error("No docMeta");
        }

        if (! docScale) {
            throw new Error("docScale");
        }

        const {pageMeta, textHighlight}
            = TextHighlighter.createTextHighlight({...opts, docMeta, docScale});

        const mutation: ITextHighlightCreate = {
            type: 'create',
            docMeta, pageMeta, textHighlight
        }

        annotationMutations.onTextHighlight(mutation);

    };

}

/**
 * Function that will register our event listeners when returned.
 */
export type AnnotationBarEventListenerRegisterer = () => void;

export function useAnnotationBar(): AnnotationBarEventListenerRegisterer {

    const store = React.useRef<Pick<IDocViewerStore, 'docMeta' | 'docScale'> | undefined>(undefined)
    const createTextHighlightCallbackRef = React.useRef<CreateTextHighlightCallback | undefined>(undefined)
    const fileType = useDocViewerFileTypeContext();

    store.current = useDocViewerStore(['docMeta', 'docScale']);
    createTextHighlightCallbackRef.current = useCreateTextHighlightCallback();

    return React.useMemo(() => {

        // TODO: we need a way to unregister the bar I think.

        const popupStateEventDispatcher = new SimpleReactor<PopupStateEvent>();
        const triggerPopupEventDispatcher = new SimpleReactor<TriggerPopupEvent>();

        const annotationBarControlledPopupProps: ControlledPopupProps = {
            id: 'annotationbar',
            placement: 'top',
            popupStateEventDispatcher,
            triggerPopupEventDispatcher
        };

        const onHighlighted: OnHighlightedCallback = (highlightCreatedEvent: HighlightCreatedEvent) => {
            console.log("onHighlighted: ", highlightCreatedEvent);

            const createTextHighlightCallback = createTextHighlightCallbackRef.current!;

            const {selection} = highlightCreatedEvent.activeSelection;

            const selectedContent = SelectedContents.computeFromSelection(selection);

            // now clear the selection since we just highlighted it.
            selection.empty();

            // FIXME: now this needs to be decoupled via postMessage...
            // but first see if it works with the PDF support...
            createTextHighlightCallback({
                pageNum: highlightCreatedEvent.pageNum,
                highlightColor: highlightCreatedEvent.highlightColor,
                selectedContent
            });

            // TextHighlighter.computeTextSelections();
        };

        const annotationBarCallbacks: AnnotationBarCallbacks = {
            onHighlighted,
            // onComment
        };

        return () => {

            ControlledAnnotationBars.create(annotationBarControlledPopupProps,
                                            annotationBarCallbacks,
                                            {fileType});

        }

    }, []);

}

