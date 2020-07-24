import React from 'react';
import {memoForwardRef} from "../react/ReactUtils";
import {DOMTextHit} from "polar-dom-text-search/src/DOMTextHit";
import {DOMHighlight} from "./DOMHighlight";

interface IProps {
    readonly hits: ReadonlyArray<DOMTextHit>;
}

// HitHighlights -> HitHighlight => HitHighlightRow

export const DOMHighlights = memoForwardRef((props: IProps) => {

    function toDOMHighlight(hit: DOMTextHit, idx: number) {
        return <DOMHighlight key={hit.id} {...hit}/>
    }

    return (
        <>
            {props.hits.map(toDOMHighlight)}
        </>
    );

})
