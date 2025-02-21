import React, { act, useEffect, useRef, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat, toLonLat } from "ol/proj";
import { Vector as VectorLayer } from "ol/layer";
import { Vector as VectorSource } from "ol/source";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { Style, Circle, Fill, Stroke, Icon } from "ol/style";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";

const API_URL = "https://gis.thynxai.tech/api";

const OpenLayersMap = () => {
  const mapRef = useRef(null);
  const clickedButtonRef = useRef(null);
  const [map, setMap] = useState(null);
  const [vectorSource] = useState(new VectorSource());
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [placeType, setPlaceType] = useState("");
  const [radius, setRadius] = useState("");
  const [isShowDataModalOpen, setIsShowDataModalOpen] = useState(false);
  const [clickedButton, setClickedButton] = useState("add");
  const [nearbyData, setNearbyData] = useState([]);
  const [nearestData, setNearestData] = useState({});
  const [totalDistance, settoTalDistance] = useState("");
  const [showNearbyDate, setShowNearbyData] = useState(false);
  const [messageShown, setMessageShown] = useState(false);

  const notify = (msg) => toast(msg);

  useEffect(() => {
    if (!mapRef?.current) return;

    const initialMap = new Map({
      target: mapRef?.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: vectorSource,
        }),
      ],
      view: new View({
        center: fromLonLat([85.824539, 20.296059]),
        zoom: 12,
      }),
    });

    setMap(initialMap);

    initialMap.on("click", async (event) => {
      const coordinate = event.coordinate;
      const lonLat = toLonLat(coordinate);
      setSelectedCoordinate(lonLat);

      if (clickedButtonRef?.current === "add") {
        setIsShowDataModalOpen(true);
      } else if (clickedButtonRef?.current === "nearby") {
        setIsShowDataModalOpen(true);
      } else if (clickedButtonRef?.current === "nearest") {
        await fetchNearestPlace(lonLat[1], lonLat[0]);
      } else if (clickedButtonRef?.current === "distance") {
        pinLocationWithImage(lonLat[1], lonLat[0]);
        setSelectedPoints((prevPoints) => {
          const newPoints = [...prevPoints, lonLat];
          if (newPoints?.length == 1)
            notify("Click on the map for select the second point");

          if (newPoints.length === 2) {
            calculateDistance(
              newPoints[0][1],
              newPoints[0][0],
              newPoints[1][1],
              newPoints[1][0]
            );
            return [];
          }
          return newPoints;
        });
      }
    });

    return () => initialMap.dispose();
  }, []);

  useEffect(() => {
    clickedButtonRef.current = clickedButton;
  }, [clickedButton]);

  const handlePlaceName = (event) => {
    setPlaceName(event.target.value);
  };

  const handlePlaceType = (event) => {
    setPlaceType(event.target.value);
  };

  const handleRadius = (event) => {
    setRadius(event.target.value);
  };

  // const handleButtonClick = async (actionName) => {
  //   if (actionName == "add") {
  //     setClickedButton("add");
  //     setSelectedPoints([]);
  //   } else if (actionName == "nearby") {
  //     setClickedButton("nearby");
  //     setSelectedPoints([]);
  //   } else if (actionName == "nearest") {
  //     setClickedButton("nearest");
  //     setSelectedPoints([]);
  //   } else if (actionName == "distance") {
  //     setClickedButton("distance");
  //     setSelectedPoints([]);
  //     notify("Click on the map for select the first point");
  //   }
  // };
  const handleButtonClick = async (actionName) => {
    if (
      actionName === "add" ||
      actionName === "nearby" ||
      actionName === "nearest"
    ) {
      setClickedButton(actionName);
      setSelectedPoints([]);
    } else if (actionName === "distance") {
      setClickedButton("distance");
      setSelectedPoints([]);
      if (!messageShown) {
        notify("Click on the map for select the first point");
        setMessageShown(true);
      }
    }
  };

  const handleAddAction = async () => {
    if (!placeName || !placeType || !selectedCoordinate) {
      notify("Name, Type, and a valid location are required");
      return;
    }

    try {
      await addLocation(
        placeName,
        placeType,
        selectedCoordinate[1],
        selectedCoordinate[0]
      );
      pinLocation(
        placeName,
        placeType,
        selectedCoordinate[1],
        selectedCoordinate[0]
      );
      setIsShowDataModalOpen(false);
      setPlaceName("");
      setPlaceType("");
    } catch (error) {
      console.error("Error adding location:", error);
      notify("Failed to create place");
    }
  };

  const handleNearbyAction = async () => {
    if (radius) {
      pinLocation(selectedCoordinate[1], selectedCoordinate[0]);
      await fetchNearbyPlaces(selectedCoordinate[1], selectedCoordinate[0]);
    } else {
      notify("Input radius");
    }
  };

  const pinLocation = (name, type, lat, lon) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      name,
      type,
    });

    feature.setStyle(
      new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: "blue" }),
          stroke: new Stroke({ color: "white", width: 2 }),
        }),
      })
    );

    vectorSource.addFeature(feature);
  };

  const pinLocationWithImage = (lat, lon) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      name: "distancePin",
      type: "distancePin",
    });

    feature.setStyle(
      new Style({
        image: new Icon({
          src: "/pin.png",
          scale: 0.1,
        }),
      })
    );

    vectorSource.addFeature(feature);
  };

  const removePin = () => {
    vectorSource.getFeatures().forEach((feature) => {
      if (feature.get("type") === "distancePin") {
        vectorSource.removeFeature(feature);
      }
    });
  };

  const addLocation = async (name, type, lat, lon) => {
    const response = await axios.post(`${API_URL}/places`, {
      name,
      type,
      latitude: lat,
      longitude: lon,
    });

    if (
      response &&
      response.data &&
      response.data.id &&
      response.status == 201
    ) {
      notify("New place created successfully");
      setIsShowDataModalOpen(false);
      setPlaceName("");
      setPlaceType("");
    } else {
      notify("Failed to create place");
    }
  };

  const fetchNearbyPlaces = async (lat, lon) => {
    const response = await axios.get(
      `${API_URL}/places/nearby?latitude=${lat}&longitude=${lon}&radius=${
        radius * 1000
      }`
    );
    setNearbyData(response.data);
    setShowNearbyData(true);
    notify(`Found ${response.data.length} nearby places`);
    response.data.forEach((place) =>
      pinLocation(place.name, place.type, place.latitude, place.longitude)
    );
  };

  const fetchNearestPlace = async (lat, lon) => {
    try {
      const response = await axios.get(
        `${API_URL}/places/nearest?latitude=${lat}&longitude=${lon}`
      );
      if (response.status === 200 && response.data) {
        setNearestData(response.data);
        setIsShowDataModalOpen(true);
        pinLocation(
          response.data.name,
          response.data.type,
          response.data.latitude,
          response.data.longitude
        );
      } else {
        notify("Failed to get nearest place data");
      }
    } catch (error) {
      console.error("Error fetching nearest place:", error);
      notify("Error fetching nearest place. Please try again.");
    }
  };

  const calculateDistance = async (lat1, lon1, lat2, lon2) => {
    const response = await axios.get(
      `${API_URL}/places/distance?lat1=${lat1}&lon1=${lon1}&lat2=${lat2}&lon2=${lon2}`
    );
    settoTalDistance(response.data.distance);
    if (
      response &&
      response.data &&
      response.data.distance &&
      response.status == 200
    )
      setIsShowDataModalOpen(true);
    else notify("Failed to get distance");
  };

  const closeModal = () => {
    setIsShowDataModalOpen(false);
    setShowNearbyData(false);
    setRadius("");
    setPlaceName("");
    setPlaceType("");
    setNearbyData([]);
    setNearestData({});
    settoTalDistance("");
    removePin();
  };

  function metersToKilometers(meters) {
    return (meters / 1000).toFixed(2) + " K.M";
  }

  return (
    <>
      <div className="w-full h-full">
        <h1 className="text-3xl font-bold text-center text-red-600 mt-2">
          PROJECT GIS
        </h1>

        <div className="w-full flex  justify-center my-4">
          <ul className=" gap-1 flex md:flex-row flex-col justify-between">
            <li onClick={() => handleButtonClick("add")}>
              <input
                type="radio"
                id="add"
                name="hosting"
                value="add"
                className="hidden peer"
                defaultChecked={clickedButton == "add"}
                required
              />
              <label
                htmlFor="add"
                className="inline-flex items-center text-sm justify-between w-full p-2 text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer dark:hover:text-gray-300 dark:border-gray-700 dark:peer-checked:text-blue-500 peer-checked:border-blue-600 dark:peer-checked:border-blue-600 peer-checked:text-blue-600 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <div className="block">
                  <div className="w-full">Add New Location</div>
                </div>
              </label>
            </li>
            <li onClick={() => handleButtonClick("nearby")}>
              <input
                type="radio"
                id="nearby"
                name="hosting"
                value="nearby"
                className="hidden peer"
                defaultChecked={clickedButton == "nearby"}
              />
              <label
                htmlFor="nearby"
                className="inline-flex items-center justify-between w-full p-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer dark:hover:text-gray-300 dark:border-gray-700 dark:peer-checked:text-blue-500 peer-checked:border-blue-600 dark:peer-checked:border-blue-600 peer-checked:text-blue-600 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <div className="block">
                  <div className="w-full">Find Nearby Locations</div>
                </div>
              </label>
            </li>
            <li onClick={() => handleButtonClick("nearest")}>
              <input
                type="radio"
                id="nearest"
                name="hosting"
                value="nearest"
                className="hidden peer"
                defaultChecked={clickedButton == "nearest"}
              />
              <label
                htmlFor="nearest"
                className="inline-flex items-center justify-between w-full p-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer dark:hover:text-gray-300 dark:border-gray-700 dark:peer-checked:text-blue-500 peer-checked:border-blue-600 dark:peer-checked:border-blue-600 peer-checked:text-blue-600 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <div className="block">
                  <div className="w-full">Find Nearest Location</div>
                </div>
              </label>
            </li>
            <li onClick={() => handleButtonClick("distance")}>
              <input
                type="radio"
                id="distance"
                name="hosting"
                value="distance"
                className="hidden peer"
                defaultChecked={clickedButton == "distance"}
              />
              <label
                htmlFor="distance"
                className="inline-flex items-center justify-between w-full p-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer dark:hover:text-gray-300 dark:border-gray-700 dark:peer-checked:text-blue-500 peer-checked:border-blue-600 dark:peer-checked:border-blue-600 peer-checked:text-blue-600 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <div className="block">
                  <div className="w-full">Calculate Distance</div>
                </div>
              </label>
            </li>
          </ul>
        </div>
        <div className="rounded overflow-hidden shadow-lg w-[100%] h-[80vh] p-2 ">
          <div className="p-6 shadow dark:bg-gray-800 rounded-xs rounded-lg rounded-md">
            <div ref={mapRef} className="w-[100%] h-[60vh]"></div>
          </div>
        </div>
      </div>

      {isShowDataModalOpen && (
        <div
          id="authentication-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        >
          <div className="bg-white rounded-lg shadow-lg  max-h-[80vh] px-4 max-w-[70%] mx-2 sm:max-w-[50%]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-semibold">
                {clickedButton == "add"
                  ? "Add New Place"
                  : clickedButton == "nearby"
                  ? "Nearby Places"
                  : clickedButton == "nearest"
                  ? "Nearest Place"
                  : "Distance"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-900"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {clickedButton == "add" ? (
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Place Name
                    </label>
                    <input
                      type="text"
                      value={placeName}
                      className="w-full border rounded-lg p-2"
                      placeholder="Enter place name"
                      onChange={handlePlaceName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Place Type
                    </label>
                    <input
                      type="text"
                      value={placeType}
                      className="w-full border rounded-lg p-2"
                      placeholder="Enter place type"
                      onChange={handlePlaceType}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="w-full bg-blue-700 text-white rounded-lg p-2 hover:bg-blue-800"
                  >
                    Add Location
                  </button>
                </form>
              ) : clickedButton == "nearby" ? (
                <>
                  <div className="flex justify-center items-center gap-2 pb-2">
                    <label className="text-sm font-medium text-center">
                      Radius
                    </label>
                    <span>
                      <input
                        type="number"
                        value={radius}
                        className="border rounded-lg p-1 w-[30%]"
                        placeholder="5"
                        onChange={handleRadius}
                      />{" "}
                      <span className="text-sm">K.M</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleNearbyAction}
                      className="bg-blue-700 text-white rounded-md p-1 hover:bg-blue-800"
                    >
                      Find Nearby Places
                    </button>
                  </div>
                  {showNearbyDate && (
                    <div>
                      <h3 className="pb-2 font-bold">List of Places</h3>
                      <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                              <th scope="col" className="px-6 py-3">
                                Place Name
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Place Type
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Distance
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {nearbyData.map((place) => (
                              <tr
                                key={place.id}
                                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 border-gray-200"
                              >
                                <th
                                  scope="row"
                                  className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
                                >
                                  {place.name}
                                </th>
                                <td className="px-6 py-4">{place.type}</td>
                                <td className="px-6 py-4">
                                  {metersToKilometers(place.distance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {nearbyData.length == 0 && (
                          <h4 className="text-center">
                            No Nearby place available
                          </h4>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : clickedButton == "nearest" ? (
                <div>
                  <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table class="w-full text-md text-left rtl:text-right text-black">
                      <tbody>
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                          <th
                            scope="row"
                            class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800"
                          >
                            Place Name
                          </th>
                          <td class="px-6 py-4 ">{nearestData.name}</td>
                        </tr>
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                          <th
                            scope="row"
                            class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800"
                          >
                            Place Type
                          </th>
                          <td class="px-6 py-4">{nearestData.type}</td>
                        </tr>
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                          <th
                            scope="row"
                            class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800"
                          >
                            Distance
                          </th>
                          <td class="px-6 py-4">
                            {metersToKilometers(nearestData.distance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <h3 className="text-center">
                  Total Distance between 2 point is{" "}
                  <span className="font-bold">
                    {metersToKilometers(totalDistance)}
                  </span>
                </h3>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </>
  );
};

export default OpenLayersMap;
