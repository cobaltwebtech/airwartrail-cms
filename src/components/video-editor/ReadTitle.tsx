import type React from "react";
import { useState } from "react";

interface ReadTitleProps {
  videoId: string;
  initialTitle: string;
}

const ReadTitle: React.FC<ReadTitleProps> = ({
  videoId,
  initialTitle,
}) => {
  
  return (
    <div className="col-span-full">
      <h3 className="text-lg font-bold">Title Name: {initialTitle}</h3>
      <p className="text-sm text-gray-500">Video Time: {videoId}</p>
    </div>
  );
};

export default ReadTitle;
