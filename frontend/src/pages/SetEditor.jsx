
import { useParams } from "react-router-dom";

function SetEditor() {
    const { setId } = useParams();

    return (
        <div>
            <h1>Set Editor</h1>
            <p>Editing study set: {setId}</p>
        </div>
    );
}

export default SetEditor;
