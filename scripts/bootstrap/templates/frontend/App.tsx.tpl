/**
 * ${pascal_name} root component. One route per entity plus a stub
 * dashboard. The real layout lands when the pages have UX.
 */

import {BrowserRouter, Route, Routes} from "react-router-dom";
import {ToastContainer} from "react-toastify";

import NavBar from "./components/NavBar";
${page_imports}

export default function App() {
    return (
        <BrowserRouter>
            <NavBar />
            <Routes>
                <Route path="/" element={<h1>${pascal_name}</h1>} />
${routes}
            </Routes>
            <ToastContainer position="bottom-right" />
        </BrowserRouter>
    );
}
