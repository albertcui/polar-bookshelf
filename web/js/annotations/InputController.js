const $ = require("jquery");

import 'bootstrap';
import 'bootstrap/js/src/util';
import 'bootstrap/js/src/modal';
import 'bootstrap/js/src/dropdown';
import 'bootstrap/js/src/tooltip';

// require('bootstrap/js/dist/modal.js');
// require('bootstrap/js/dist/dropdown.js');
// require('bootstrap/js/dist/tooltip.js');
// require('bootstrap/dist/css/bootstrap.css');
// require('font-awesome/css/font-awesome.css');
// require('summernote/dist/summernote.css');
require('summernote/dist/summernote-bs4');

import React, {Component} from "react";
import { render } from "react-dom";

import Form from "react-jsonschema-form";
import SimpleMDE from 'react-simplemde-editor';

import ReactSummernote from 'react-summernote';

//import {ImagePasteHandler} from "../paste/ImagePasteHandler";

/**
 * Code to accept new input for flashcards, notes, comments, etc.
 */
class InputController {

    createNewFlashcard(targetElement, formHandler) {

        const schema = {
            "title": "Flashcard",
            "description": "",
            "type": "object",
            "required": [
                "front",
                "back"
            ],
            "properties": {
                "front": {
                    "type": "string",
                    "title": "Front"
                },
                "back": {
                    "type": "string",
                    "title": "Back"
                }
                // },
                // "age": {
                //     "type": "integer",
                //     "title": "Age"
                // },
                // "bio": {
                //     "type": "string",
                //     "title": "Bio"
                // },
                // "password": {
                //     "type": "string",
                //     "title": "Password",
                //     "minLength": 3
                // },
                // "telephone": {
                //     "type": "string",
                //     "title": "Telephone",
                //     "minLength": 10
                // }
            }
        };

        const uiSchema = {

            front: {
                "ui:widget": RichTextEditor,
            },
            back: {
                "ui:widget": RichTextEditor,
            }

        };

        SimpleMDE.defaultProps = {
            options: {
                // enabling
                spellChecker: false,
                // setting to true re-downloads font awesome and it's much better
                // to have this as a dependency inline.
                autoDownloadFontAwesome: false,
                status: false,
                hideIcons: ["side-by-side", "fullscreen"],
                forceSync: true,
                extraKeys: {},
                //extraKeys['Tab'] = false,
                //extraKeys['Shift-Tab'] = false;
            },
            label: false

        };

        if(!targetElement) {
            throw new Error("No schemaFormElement");
        }

        let onChangeCallback = (data) => function(data) { formHandler.onChange(data) };
        let onSubmitCallback = (data) => function(data) { formHandler.onSubmit(data) };
        let onErrorCallback = (data) => function(data) { formHandler.onError(data) };

        render((
            <Form schema={schema}
                  autocomplete="off"
                  uiSchema={uiSchema}
                  onChange={onChangeCallback()}
                  onSubmit={onSubmitCallback()}
                  onError={onErrorCallback()} />
        ), targetElement);

    }

}

class RichTextEditor extends Component {

    onChange(content) {
        console.log('onChange', content);
    }

    render() {
        return (
            <ReactSummernote
                value="Default value"
                options={{
                    lang: 'ru-RU',
                    height: 350,
                    dialogsInBody: true,
                    toolbar: [
                        ['style', ['style']],
                        ['font', ['bold', 'underline', 'clear']],
                        ['fontname', ['fontname']],
                        ['para', ['ul', 'ol', 'paragraph']],
                        ['table', ['table']],
                        ['insert', ['link', 'picture', 'video']],
                        ['view', ['fullscreen', 'codeview']]
                    ]
                }}
                onChange={this.onChange}
            />
        );
    }
}

function MarkdownWidget(props) {

    const {id, classNames, label, help, required, description, errors, children} = props;

    let result = (
        <div className="simplemde-control" data-required={required} data-textarea-id={id}>
            <div className={classNames}>
                {description}
                {children}
                {errors}
                {help}
                <SimpleMDE onChange={(newValue) => props.onChange(newValue)} label="" id={id}/>
            </div>
        </div>
    );

    return result;

}

module.exports.InputController = InputController;

